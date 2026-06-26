import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProductionOrdersService } from '../production-orders/production-orders.service';
import { CreateFactoryActivityDto } from './dto/create-factory-activity.dto';
import { UpdateFactoryActivityDto } from './dto/update-factory-activity.dto';
import {
  calculateFactoryActivityTotal,
  parseFactoryWorkerNames,
} from './factory-activity.utils';

@Injectable()
export class FactoryActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productionOrdersService: ProductionOrdersService,
  ) {}

  async create(dto: CreateFactoryActivityDto) {
    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.factoryWorkerActivity.create({
        data: {
          productOrderId: dto.productOrderId,
          locationId: dto.locationId,
          supervisorId: dto.supervisorId,
          workerNames: JSON.stringify(dto.workerNames),
          workDate: new Date(dto.workDate),
          quantityAllocated: dto.quantityAllocated,
          quantityFinished: dto.quantityFinished ?? 0,
          quantityWasted: dto.quantityWasted ?? 0,
          typeOfFinishing: dto.typeOfFinishing,
          costPerFinish: dto.costPerFinish,
          notes: dto.notes,
        },
        include: {
          location: true,
          productOrder: {
            select: { id: true, sku: true, productName: true },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
        },
      });

      await this.productionOrdersService.recalculateOrderTotalsInTransaction(
        tx,
        dto.productOrderId,
      );

      return created;
    });

    return this.serializeActivity(activity);
  }

  async findAll(
    locationId?: string,
    supervisorId?: string,
    productOrderId?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(locationId ? { locationId } : {}),
      ...(supervisorId ? { supervisorId } : {}),
      ...(productOrderId ? { productOrderId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.factoryWorkerActivity.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          location: true,
          productOrder: {
            select: { id: true, sku: true, productName: true },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
        },
      }),
      this.prisma.factoryWorkerActivity.count({ where }),
    ]);

    return {
      items: items.map((activity) => this.serializeActivity(activity)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const activity = await this.prisma.factoryWorkerActivity.findUnique({
      where: { id },
      include: {
        location: true,
        productOrder: {
          select: { id: true, sku: true, productName: true },
        },
        supervisor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.serializeActivity(activity);
  }

  async update(id: string, dto: UpdateFactoryActivityDto) {
    const existing = await this.prisma.factoryWorkerActivity.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Activity not found');

    const activity = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.factoryWorkerActivity.update({
        where: { id },
        data: {
          ...(dto.productOrderId !== undefined && {
            productOrderId: dto.productOrderId,
          }),
          ...(dto.locationId !== undefined && { locationId: dto.locationId }),
          ...(dto.workDate !== undefined && {
            workDate: new Date(dto.workDate),
          }),
          ...(dto.supervisorId !== undefined && {
            supervisorId: dto.supervisorId,
          }),
          ...(dto.workerNames !== undefined && {
            workerNames: JSON.stringify(dto.workerNames),
          }),
          ...(dto.quantityAllocated !== undefined && {
            quantityAllocated: dto.quantityAllocated,
          }),
          ...(dto.quantityFinished !== undefined && {
            quantityFinished: dto.quantityFinished,
          }),
          ...(dto.quantityWasted !== undefined && {
            quantityWasted: dto.quantityWasted,
          }),
          ...(dto.typeOfFinishing !== undefined && {
            typeOfFinishing: dto.typeOfFinishing,
          }),
          ...(dto.costPerFinish !== undefined && {
            costPerFinish: dto.costPerFinish,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: {
          location: true,
          productOrder: {
            select: { id: true, sku: true, productName: true },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
        },
      });

      const affectedOrderIds = new Set(
        [existing.productOrderId, updated.productOrderId].filter(
          (value): value is string => !!value,
        ),
      );

      for (const productOrderId of affectedOrderIds) {
        await this.productionOrdersService.recalculateOrderTotalsInTransaction(
          tx,
          productOrderId,
        );
      }

      return updated;
    });

    return this.serializeActivity(activity);
  }

  async remove(id: string) {
    const existing = await this.prisma.factoryWorkerActivity.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Activity not found');
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.factoryWorkerActivity.delete({ where: { id } });

      if (existing.productOrderId) {
        await this.productionOrdersService.recalculateOrderTotalsInTransaction(
          tx,
          existing.productOrderId,
        );
      }

      return deleted;
    });
  }

  private serializeActivity<
    T extends {
      workerNames: string;
      quantityFinished?: number | null;
      costPerFinish?: { toString(): string } | string | number | null;
    },
  >(activity: T) {
    return {
      ...activity,
      workerNames: parseFactoryWorkerNames(activity.workerNames),
      totalAmount: calculateFactoryActivityTotal({
        quantityFinished: activity.quantityFinished,
        costPerFinish: activity.costPerFinish,
      }),
    };
  }
}
