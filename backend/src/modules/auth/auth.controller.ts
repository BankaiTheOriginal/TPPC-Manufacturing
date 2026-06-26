import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuditService } from 'src/modules/audit-logs/audit.service';
import {
  AuditCtx,
  type AuditRequestContext,
} from 'src/modules/audit-logs/audit.context';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  @Roles('ADMINISTRATOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'HUMAN_RESOURCES')
  @Post('signup')
  async signup(
    @Body() data: SignupDto,
    @Req() req: Request & { user?: { sub?: string } },
    @AuditCtx() ctx: AuditRequestContext,
  ) {
    const result = await this.authService.signup(data);
    await this.audit.logRbac({
      action: 'USER_CREATED',
      userId: req.user?.sub ?? 'system',
      targetUserId: result.id,
      after: { email: result.email, role: result.role, staffId: result.staffId },
      ctx,
    });
    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @AuditCtx() ctx: AuditRequestContext,
  ) {
    let session: Awaited<ReturnType<AuthService['login']>>;
    try {
      session = await this.authService.login(body.email, body.password);
    } catch (err) {
      await this.audit.logAuth({
        action: 'LOGIN_FAILURE',
        actorEmail: body.email,
        status: 'FAILURE',
        severity: 'WARN',
        ctx,
      });
      throw err;
    }
    const { access_token, user, refresh_token } = session;
    const isSecure =
      this.config.getOrThrow<string>('node_env') === 'production';
    res.cookie('refreshToken', refresh_token, {
      httpOnly: true,
      sameSite: isSecure ? 'none' : 'lax',
      domain: isSecure ? '.exxforce.com' : undefined,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: isSecure,
    });

    await this.audit.logAuth({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      actorEmail: user.email,
      ctx,
    });

    return { access_token, user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @AuditCtx() ctx: AuditRequestContext) {
    const cookie = req.cookies as Record<string, string>;
    const refresh_token = cookie['refreshToken'];
    if (!refresh_token)
      throw new UnauthorizedException('Refresh Token not Found');
    const result = await this.authService.refreshAccessToken(refresh_token);
    await this.audit.logAuth({ action: 'TOKEN_REFRESH', ctx });
    return result;
  }

  @Public()
  @Post('rotate')
  async rotate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuditCtx() ctx: AuditRequestContext,
  ) {
    const cookie = req.cookies as Record<string, string>;
    const refreshToken = cookie['refreshToken'];
    const { access_token, refresh_token } =
      await this.authService.rotateToken(refreshToken);

    const isSecure =
      this.config.getOrThrow<string>('node_env') === 'production';
    res.cookie('refreshToken', refresh_token, {
      httpOnly: true,
      sameSite: isSecure ? 'none' : 'lax',
      domain: isSecure ? '.exxforce.com' : undefined,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: isSecure,
    });

    await this.audit.logAuth({ action: 'TOKEN_ROTATE', ctx });

    return { access_token };
  }

  @Post('logout')
  async logout(
    @Req() req: Request & { user?: { sub: string } },
    @Res({ passthrough: true }) res: Response,
    @AuditCtx() ctx: AuditRequestContext,
  ) {
    const userId = req.user?.sub;
    if (userId) {
      await this.authService.logout(userId);
      await this.audit.logAuth({
        action: 'LOGOUT',
        userId,
        ctx,
      });
    }
    res.clearCookie('refreshToken', { path: '/' });
    return { ok: true };
  }
}

