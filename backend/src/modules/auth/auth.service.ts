import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.strategy';
import * as crypto from 'crypto';
import { USER_AUTH_SELECT, USER_PUBLIC_SELECT } from '../user/user.constants';
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  hashToken(token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash;
  }

  verifyToken(token: string, hash: string) {
    const hashedToken = this.hashToken(token);

    const hashedBuffer = Buffer.from(hashedToken, 'hex');
    const targetBuffer = Buffer.from(hash, 'hex');

    if (hashedBuffer.length !== targetBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashedBuffer, targetBuffer);
  }

  private isJwtPayload(obj: unknown): obj is JwtPayload {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'sub' in obj &&
      typeof (obj as { sub?: unknown }).sub === 'string'
    );
  }

  async signup(input: SignupDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { staffId: input.staffId }],
      },
    });

    if (user)
      throw new BadRequestException('A user already exists with that email or staff ID');

    const locationId = input.locationId
      ? (
          await this.prisma.location.findUnique({
            where: { id: input.locationId },
            select: { id: true },
          })
        )?.id
      : undefined;

    if (input.locationId && !locationId) {
      throw new BadRequestException('Location not found');
    }

    const hashedPassword = await argon2.hash(input.password);

    return this.prisma.user.create({
      data: {
        staffId: input.staffId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        locationId,
        jobTitle: input.jobTitle,
        department: input.department,
        phoneNumber: input.phoneNumber,
        reportingLine: input.reportingLine,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        password: hashedPassword,
      },
      select: USER_PUBLIC_SELECT,
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: USER_AUTH_SELECT,
    });

    if (!user) throw new UnauthorizedException('Email or Password Incorrect');
    if (!user.isActive)
      throw new UnauthorizedException('Email or Password Incorrect');

    const verifiedPassword = await argon2.verify(user.password, password);
    if (!verifiedPassword)
      throw new UnauthorizedException('Email or Password Incorrect');

    const payload: JwtPayload = {
      sub: user.id,
    };
    const access_token = this.jwt.sign(payload, { expiresIn: '1h' });
    const refresh_token = this.jwt.sign(payload, { expiresIn: '7d' });
    const hashedToken = this.hashToken(refresh_token);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedToken, lastLogin: new Date() },
    });

    const { password: _password, refreshToken: _refreshToken, ...safeUser } =
      user;

    return { access_token, refresh_token, user: safeUser };
  }

  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });
  }

  async refreshAccessToken(refresh_token: string) {
    let maybePayload: unknown;
    try {
      maybePayload = this.jwt.verify(refresh_token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!this.isJwtPayload(maybePayload)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const payload: JwtPayload = maybePayload;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.refreshToken) throw new UnauthorizedException('Unauthorized');
    const verifiedRefreshToken = this.verifyToken(
      refresh_token,
      user.refreshToken,
    );
    if (!verifiedRefreshToken) throw new UnauthorizedException('Unauthorized');
    const access_token = this.jwt.sign({ sub: user.id } as JwtPayload, {
      expiresIn: '1h',
    });
    return { access_token };
  }

  async rotateToken(refresh_token: string) {
    let maybePayload: unknown;
    try {
      maybePayload = this.jwt.verify(refresh_token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!this.isJwtPayload(maybePayload)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const payload: JwtPayload = maybePayload;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.refreshToken) throw new UnauthorizedException('Unauthorized');

    const verifiedRefreshToken = this.verifyToken(
      refresh_token,
      user.refreshToken,
    );
    if (!verifiedRefreshToken) throw new UnauthorizedException('Unauthorized');
    const newPayload: JwtPayload = { sub: user.id };
    const access_token = this.jwt.sign(newPayload, { expiresIn: '1h' });
    const new_refresh_token = this.jwt.sign(newPayload, { expiresIn: '7d' });
    const hashed_refreshToken = this.hashToken(new_refresh_token);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashed_refreshToken },
    });
    return { access_token, refresh_token: new_refresh_token };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const verifyPassword = await argon2.verify(user.password, oldPassword);
    if (!verifyPassword) throw new BadRequestException('Wrong old password');

    const verifyNewPassword = await argon2.verify(user.password, newPassword);
    if (verifyNewPassword)
      throw new BadRequestException('Choose a different password');

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be more than 8 characters');
    }
    const hashedNewPassword = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });
  }
}
