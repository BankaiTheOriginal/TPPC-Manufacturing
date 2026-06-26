import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUsersDto, ImportUserRowDto } from './dto/import-users.dto';
import * as argon2 from 'argon2';
import { USER_PUBLIC_SELECT } from './user.constants';
import { Role } from 'generated/prisma/enums';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(page: number, limit: number, role?: string) {
    return this.prisma.user.findMany({
      where: role ? { role: role as never } : undefined,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: USER_PUBLIC_SELECT,
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async updateUser(id: string, data: UpdateUserDto) {
    const user = await this.getUser(id);
    const {
      staffId,
      firstName,
      lastName,
      email,
      password,
      role,
      locationId,
      jobTitle,
      department,
      phoneNumber,
      reportingLine,
      isActive,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = data;

    const hasLocationId = Object.prototype.hasOwnProperty.call(
      data,
      'locationId',
    );
    const resolvedLocationId = hasLocationId
      ? await this.resolveLocationId(locationId ?? null)
      : undefined;

    const hashedPassword = password ? await argon2.hash(password) : undefined;

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        staffId,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        ...(resolvedLocationId !== undefined && { locationId: resolvedLocationId }),
        jobTitle,
        department,
        phoneNumber,
        reportingLine,
        isActive,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      },
      select: USER_PUBLIC_SELECT,
    });
  }

  async deleteUser(id: string) {
    try {
      const user = await this.getUser(id);

      return this.prisma.user.delete({
        where: { id: user.id },
        select: USER_PUBLIC_SELECT,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException('Error deleting user');
    }
  }

  async bulkDeleteUsers(ids: string[]) {
    if (!Array.isArray(ids))
      throw new BadRequestException('ids must be an array');
    if (ids.length === 0) return { deleted: 0 };

    try {
      // Delete each user in a transaction for consistency
      const res = await this.prisma.$transaction(
        ids.map((id) => this.prisma.user.delete({ where: { id } })),
      );
      return { deleted: res.length };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error bulk deleting users');
    }
  }

  async importUsers(data: ImportUsersDto) {
    const summary: {
      created: number;
      updated: number;
      failed: number;
      errors: Array<{
        row: number;
        staffId?: string;
        email?: string;
        message: string;
      }>;
    } = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    const defaultPassword = this.normalizeText(data.defaultPassword);
    if (defaultPassword && defaultPassword.length < 8) {
      throw new BadRequestException(
        'Default password must be at least 8 characters long',
      );
    }

    for (const [index, row] of data.rows.entries()) {
      try {
        const normalized = await this.normalizeImportRow(row, defaultPassword);
        const [existingByStaffId, existingByEmail] = await Promise.all([
          this.prisma.user.findUnique({
            where: { staffId: normalized.staffId },
            select: { id: true },
          }),
          this.prisma.user.findUnique({
            where: { email: normalized.email },
            select: { id: true },
          }),
        ]);

        if (
          existingByStaffId &&
          existingByEmail &&
          existingByStaffId.id !== existingByEmail.id
        ) {
          throw new BadRequestException(
            'Staff ID and email match different existing users',
          );
        }

        const existingUser = existingByStaffId ?? existingByEmail;

        if (existingUser) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              staffId: normalized.staffId,
              firstName: normalized.firstName,
              lastName: normalized.lastName,
              email: normalized.email,
              role: normalized.role,
              locationId: normalized.locationId,
              jobTitle: normalized.jobTitle,
              department: normalized.department,
              phoneNumber: normalized.phoneNumber,
              reportingLine: normalized.reportingLine,
              addressLine1: normalized.addressLine1,
              addressLine2: normalized.addressLine2,
              city: normalized.city,
              state: normalized.state,
              postalCode: normalized.postalCode,
              country: normalized.country,
              ...(normalized.passwordForUpdate && {
                password: await argon2.hash(normalized.passwordForUpdate),
              }),
            },
          });
          summary.updated += 1;
          continue;
        }

        await this.prisma.user.create({
          data: {
            staffId: normalized.staffId,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            email: normalized.email,
            password: await argon2.hash(normalized.passwordForCreate),
            role: normalized.role,
            locationId: normalized.locationId,
            jobTitle: normalized.jobTitle,
            department: normalized.department,
            phoneNumber: normalized.phoneNumber,
            reportingLine: normalized.reportingLine,
            addressLine1: normalized.addressLine1,
            addressLine2: normalized.addressLine2,
            city: normalized.city,
            state: normalized.state,
            postalCode: normalized.postalCode,
            country: normalized.country,
          },
        });
        summary.created += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          row: index + 2,
          staffId: this.normalizeText(row.staffId),
          email: this.normalizeText(row.email),
          message:
            error instanceof HttpException
              ? error.message
              : 'Failed to import user',
        });
      }
    }

    return summary;
  }

  private normalizeText(value: string | null | undefined) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeRole(value: string | null | undefined) {
    const normalized = this.normalizeText(value)
      ?.toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalized) {
      return undefined;
    }

    const directRole = Object.values(Role).find((role) => role === normalized);
    if (directRole) {
      return directRole;
    }

    const aliases: Record<string, Role> = {
      ADMIN: Role.ADMINISTRATOR,
      ADMINISTRATOR: Role.ADMINISTRATOR,
      GENERAL_MANAGER: Role.GENERAL_MANAGER,
      PRODUCTION_MANAGER: Role.PRODUCTION_MANAGER,
      HEAD_OF_OPERATIONS: Role.HEAD_OF_OPERATIONS,
      HEAD_OPERATIONS: Role.HEAD_OF_OPERATIONS,
      SUPERVISOR: Role.SUPERVISOR,
      ACCOUNTANT: Role.ACCOUNTANT,
      LOGISTICS: Role.LOGISTICS_TEAM,
      LOGISTICS_TEAM: Role.LOGISTICS_TEAM,
      DESIGN: Role.DESIGN_TEAM,
      DESIGN_TEAM: Role.DESIGN_TEAM,
      HR: Role.HUMAN_RESOURCES,
      HUMAN_RESOURCE: Role.HUMAN_RESOURCES,
      HUMAN_RESOURCES: Role.HUMAN_RESOURCES,
      CUSTOMER_CARE: Role.CUSTOMER_CARE,
      CUSTOMER_SERVICE: Role.CUSTOMER_CARE,
      FACTORY_WORKER: Role.FACTORY_WORKER,
      FACTORY_WORKERS: Role.FACTORY_WORKER,
    };

    return aliases[normalized];
  }

  private async resolveLocationId(
    locationId: string | null | undefined,
    locationName?: string | null | undefined,
  ) {
    if (locationId === null) {
      return null;
    }

    const normalizedLocationId = this.normalizeText(locationId);
    if (normalizedLocationId) {
      const location = await this.prisma.location.findUnique({
        where: { id: normalizedLocationId },
        select: { id: true },
      });

      if (!location) {
        throw new BadRequestException(
          `Location \"${normalizedLocationId}\" not found`,
        );
      }

      return location.id;
    }

    const normalizedLocationName = this.normalizeText(locationName);
    if (!normalizedLocationName) {
      return undefined;
    }

    const location = await this.prisma.location.findFirst({
      where: {
        name: {
          equals: normalizedLocationName,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (!location) {
      throw new BadRequestException(
        `Location \"${normalizedLocationName}\" not found`,
      );
    }

    return location.id;
  }

  private async normalizeImportRow(
    row: ImportUserRowDto,
    defaultPassword?: string,
  ) {
    const staffId = this.normalizeText(row.staffId);
    const firstName = this.normalizeText(row.firstName);
    const lastName = this.normalizeText(row.lastName);
    const email = this.normalizeText(row.email)?.toLowerCase();
    const role = this.normalizeRole(row.role);
    const password = this.normalizeText(row.password);

    if (!staffId) {
      throw new BadRequestException('Staff ID is required');
    }
    if (!firstName) {
      throw new BadRequestException('First name is required');
    }
    if (!lastName) {
      throw new BadRequestException('Last name is required');
    }
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    if (!role) {
      throw new BadRequestException('Role is required or invalid');
    }

    const passwordForCreate = password ?? defaultPassword;
    if (!passwordForCreate) {
      throw new BadRequestException(
        'Password is required for new users. Provide a password column or default password.',
      );
    }
    if (passwordForCreate.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    const locationId = await this.resolveLocationId(
      row.locationId,
      row.location,
    );

    return {
      staffId,
      firstName,
      lastName,
      email,
      role,
      locationId: locationId ?? null,
      passwordForCreate,
      passwordForUpdate: password,
      jobTitle: this.normalizeText(row.jobTitle),
      department: this.normalizeText(row.department),
      phoneNumber: this.normalizeText(row.phoneNumber),
      reportingLine: this.normalizeText(row.reportingLine),
      addressLine1: this.normalizeText(row.addressLine1),
      addressLine2: this.normalizeText(row.addressLine2),
      city: this.normalizeText(row.city),
      state: this.normalizeText(row.state),
      postalCode: this.normalizeText(row.postalCode),
      country: this.normalizeText(row.country),
    };
  }
}
