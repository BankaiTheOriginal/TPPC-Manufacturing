import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationStage } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async getVendors(operationStage?: OperationStage) {
    return this.prisma.vendor.findMany({
      where: operationStage ? { operationStage } : undefined,
      orderBy: [{ operationStage: 'asc' }, { name: 'asc' }],
    });
  }

  async getVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async createVendor(input: CreateVendorDto) {
    const name = this.normalizeName(input.name);
    await this.ensureUnique(name, input.operationStage);

    return this.prisma.vendor.create({
      data: {
        name,
        operationStage: input.operationStage,
      },
    });
  }

  async updateVendor(id: string, input: UpdateVendorDto) {
    const existing = await this.prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');

    const name =
      input.name !== undefined ? this.normalizeName(input.name) : existing.name;
    const operationStage = input.operationStage ?? existing.operationStage;

    await this.ensureUnique(name, operationStage, id);

    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name }),
        ...(input.operationStage !== undefined && { operationStage }),
      },
    });
  }

  async deleteVendor(id: string) {
    const existing = await this.prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.delete({ where: { id } });
  }

  private normalizeName(value: string) {
    const name = value.trim();
    if (!name) {
      throw new BadRequestException('Vendor name is required');
    }
    return name;
  }

  private async ensureUnique(
    name: string,
    operationStage: OperationStage,
    excludeId?: string,
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: {
        name,
        operationStage,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'A vendor with this name already exists for the selected operation',
      );
    }
  }
}