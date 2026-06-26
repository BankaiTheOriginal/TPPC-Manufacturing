import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationStage } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';

@Injectable()
export class MachineryService {
  constructor(private readonly prisma: PrismaService) {}

  async getMachinery(operationStage?: OperationStage) {
    return this.prisma.machine.findMany({
      where: operationStage ? { operationStage } : undefined,
      orderBy: [{ operationStage: 'asc' }, { name: 'asc' }],
    });
  }

  async getMachine(id: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id } });
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async createMachine(input: CreateMachineDto) {
    const name = this.normalizeName(input.name);
    await this.ensureUnique(name, input.operationStage);

    return this.prisma.machine.create({
      data: {
        name,
        operationStage: input.operationStage,
      },
    });
  }

  async updateMachine(id: string, input: UpdateMachineDto) {
    const existing = await this.prisma.machine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Machine not found');

    const name =
      input.name !== undefined ? this.normalizeName(input.name) : existing.name;
    const operationStage = input.operationStage ?? existing.operationStage;

    await this.ensureUnique(name, operationStage, id);

    return this.prisma.machine.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name }),
        ...(input.operationStage !== undefined && { operationStage }),
      },
    });
  }

  async deleteMachine(id: string) {
    const existing = await this.prisma.machine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Machine not found');
    return this.prisma.machine.delete({ where: { id } });
  }

  private normalizeName(value: string) {
    const name = value.trim();
    if (!name) {
      throw new BadRequestException('Machine name is required');
    }
    return name;
  }

  private async ensureUnique(
    name: string,
    operationStage: OperationStage,
    excludeId?: string,
  ) {
    const existing = await this.prisma.machine.findFirst({
      where: {
        name,
        operationStage,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'A machine with this name already exists for the selected operation',
      );
    }
  }
}