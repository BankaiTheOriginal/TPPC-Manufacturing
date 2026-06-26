import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ZohoSyncService } from 'src/modules/zoho/zoho-sync.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import type { Prisma } from 'generated/prisma/client';
import type {
  ProductOrderMaterial,
  ProductOrderOperation,
} from 'generated/prisma/browser';
import { OperationStage, Priority } from 'generated/prisma/enums';
import {
  calculateFactoryActivityTotal,
  parseFactoryWorkerNames,
} from 'src/modules/factory-activity/factory-activity.utils';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { UpsertOperationDto } from './dto/upsert-operation.dto';
import { AddMaterialDto } from './dto/add-material.dto';
import {
  buildPaperRuleFromInventoryItem,
  calculateRemainingCutCapacity,
  calculateCuttingMetrics,
  calculateSheetFractionUsed,
  calculateSourceSheetsRequired,
  extractSourceSheetSize,
  getProductionRules,
  isKnownCutSize,
  normalizeSize,
} from './production-rules';
import {
  buildFactoryLabourServiceSummary,
  buildOperationServiceSummary,
} from './operation-services';

type SalesOrderLookupRecord = {
  zohoBooksId: string;
  salesOrderNumber: string;
  customer: string | null;
};

type ProductOrderWithTracking<T extends {
  zohoBooksId?: string | null;
  createdAt: Date | string;
}> = T & {
  salesOrderNumber: string | null;
  salesOrderCustomerName: string | null;
  referenceId: string | null;
};

const TASK_STAGE_ALIASES: Record<string, OperationStage> = {
  CTP: OperationStage.CTP_MAKING,
  DIE_CUTTING: OperationStage.DIECUTTING,
};

const TASK_STAGE_VALUES = new Set<string>(Object.values(OperationStage));

@Injectable()
export class ProductionOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zohoSyncService: ZohoSyncService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listProductionOrders(
    page: number,
    limit: number,
    includeOperations = false,
    search?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productOrder.findMany({
        where,
        include: {
          _count: true,
          ...(includeOperations ? { productOrderOperations: true } : {}),
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productOrder.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listAllTasks(
    page: number,
    limit: number,
    stage?: string,
    status?: string,
    search?: string,
    productOrderId?: string,
    salesOrderId?: string,
    priority?: string,
    sortBy?: string,
    sortDirection?: string,
    assignedStaffId?: string,
  ) {
    const normalizedSearch = search?.trim();
    const normalizedStage = this.normalizeTaskStage(stage);
    const whereClauses: Prisma.ProductOrderOperationWhereInput[] = [];

    if (normalizedStage) {
      whereClauses.push({ operationStage: normalizedStage });
    }

    if (status) {
      whereClauses.push({ stageStatus: status });
    }

    if (productOrderId) {
      whereClauses.push({ productOrderId });
    }

    if (salesOrderId) {
      whereClauses.push({
        productOrder: { is: { zohoBooksId: salesOrderId } },
      });
    }

    if (priority) {
      whereClauses.push({
        productOrder: { is: { priority: priority as Priority } },
      });
    }

    if (assignedStaffId) {
      whereClauses.push({ assignedStaffId });
    }

    if (normalizedSearch) {
      whereClauses.push({
        OR: [
          {
            operationName: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            productOrder: {
              is: {
                OR: [
                  {
                    productName: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    sku: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    zohoBooksId: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
          {
            assignedStaff: {
              is: {
                OR: [
                  {
                    firstName: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    lastName: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    staffId: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    const where: Prisma.ProductOrderOperationWhereInput =
      whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };
    const orderBy = this.buildTaskOrderBy(sortBy, sortDirection);

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.productOrderOperation.findMany({
        where,
        include: {
          productOrder: {
            select: {
              id: true,
              sku: true,
              productName: true,
              quantity: true,
              priority: true,
              status: true,
              zohoBooksId: true,
              createdAt: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
          inventory: {
            select: { id: true, itemName: true, sku: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productOrderOperation.count({ where }),
    ]);

    // Compute planned and completed cut quantities per production order.
    const productOrderIds = [
      ...new Set(tasks.map((t) => t.productOrderId)),
    ];
    const cuttingOps =
      productOrderIds.length > 0
        ? await this.prisma.productOrderOperation.findMany({
            where: {
              productOrderId: { in: productOrderIds },
              operationStage: 'CUTTING',
            },
            select: {
              id: true,
              productOrderId: true,
              paperSelectionOpId: true,
              cutQuantity: true,
              quantityFinished: true,
            },
          })
        : [];
    const completedPaperSelections =
      productOrderIds.length > 0
        ? await this.prisma.productOrderOperation.findMany({
            where: {
              productOrderId: { in: productOrderIds },
              operationStage: 'PAPER_SELECTION',
              quantityFinished: { not: null },
            },
            select: { productOrderId: true, quantityFinished: true },
          })
        : [];
    const plannedCutsByOrder = new Map<string, number>();
    const completedCutsByOrder = new Map<string, number>();
    const completedPaperCutoutsByOrder = new Map<string, number>();
    const plannedCutsByPaperSelection = new Map<string, number>();
    for (const op of cuttingOps) {
      const planned = op.cutQuantity ?? 0;
      const completed = op.quantityFinished ?? 0;
      plannedCutsByOrder.set(
        op.productOrderId,
        (plannedCutsByOrder.get(op.productOrderId) ?? 0) + planned,
      );
      completedCutsByOrder.set(
        op.productOrderId,
        (completedCutsByOrder.get(op.productOrderId) ?? 0) + completed,
      );
      if (op.paperSelectionOpId) {
        plannedCutsByPaperSelection.set(
          op.paperSelectionOpId,
          (plannedCutsByPaperSelection.get(op.paperSelectionOpId) ?? 0) +
            planned,
        );
      }
    }
    for (const op of completedPaperSelections) {
      completedPaperCutoutsByOrder.set(
        op.productOrderId,
        (completedPaperCutoutsByOrder.get(op.productOrderId) ?? 0) +
          (op.quantityFinished ?? 0),
      );
    }
    const salesOrderLookup = await this.getSalesOrderLookup(
      tasks.map((task) => task.productOrder.zohoBooksId),
    );

    const enrichedTasks = tasks.map((t) => {
      const plannedCuts = plannedCutsByOrder.get(t.productOrderId) ?? 0;
      const completedCuts = completedCutsByOrder.get(t.productOrderId) ?? 0;
      const completedPaperCutouts =
        completedPaperCutoutsByOrder.get(t.productOrderId) ?? 0;
      const availableQuantity =
        completedCuts > 0
          ? completedCuts
          : completedPaperCutouts > 0
            ? completedPaperCutouts
          : plannedCuts > 0
            ? plannedCuts
            : t.productOrder.quantity;

      let expectedQuantity = availableQuantity;
      if (t.operationStage === 'CUTTING') {
        expectedQuantity = t.cutQuantity ?? availableQuantity;
      } else if (t.operationStage === 'PAPER_SELECTION') {
        expectedQuantity =
          plannedCutsByPaperSelection.get(t.id) ??
          (t.quantityOfSheetsTaken && t.cutoutsPerSheet
            ? t.quantityOfSheetsTaken * t.cutoutsPerSheet
            : availableQuantity);
      }

      // Determine if there are new cutouts available for cutout-dependent stages
      const cutoutIndependentStages = [
        'PAPER_SELECTION',
        'CUTTING',
        'ARTWORK_DESIGN',
        'CTP_MAKING',
      ];
      const isCutoutDependent = !cutoutIndependentStages.includes(
        t.operationStage,
      );
      const effectiveCompletedCuts =
        completedCuts > 0 ? completedCuts : completedPaperCutouts;
      const hasNewCutouts =
        isCutoutDependent &&
        effectiveCompletedCuts > 0 &&
        effectiveCompletedCuts > (t.quantityFinished ?? 0);

      return {
        ...t,
        productOrder: this.attachSalesOrderTracking(
          t.productOrder,
          salesOrderLookup,
        ),
        availableQuantity,
        expectedQuantity,
        plannedCutQuantity: plannedCuts,
        completedCutQuantity:
          completedCuts > 0 ? completedCuts : completedPaperCutouts,
        hasNewCutouts,
      };
    });

    return {
      tasks: enrichedTasks,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async listTaskFilterOptions() {
    const productOrders = await this.prisma.productOrder.findMany({
      where: {
        productOrderOperations: {
          some: {},
        },
      },
      select: {
        id: true,
        sku: true,
        productName: true,
        zohoBooksId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const salesOrderLookup = await this.getSalesOrderLookup(
      productOrders.map((order) => order.zohoBooksId),
    );

    const productionOrdersWithTracking = productOrders.map((order) =>
      this.attachSalesOrderTracking(order, salesOrderLookup),
    );

    const salesOrdersById = new Map<
      string,
      {
        salesorderId: string;
        salesorderNumber: string;
        customerName: string | null;
        productionCount: number;
      }
    >();

    for (const order of productionOrdersWithTracking) {
      if (!order.zohoBooksId || !order.salesOrderNumber) {
        continue;
      }

      const existing = salesOrdersById.get(order.zohoBooksId);
      if (existing) {
        existing.productionCount += 1;
        continue;
      }

      salesOrdersById.set(order.zohoBooksId, {
        salesorderId: order.zohoBooksId,
        salesorderNumber: order.salesOrderNumber,
        customerName: order.salesOrderCustomerName,
        productionCount: 1,
      });
    }

    return {
      productionOrders: productionOrdersWithTracking,
      salesOrders: Array.from(salesOrdersById.values()).sort((left, right) =>
        left.salesorderNumber.localeCompare(right.salesorderNumber),
      ),
    };
  }

  private normalizeTaskStage(stage?: string): OperationStage | undefined {
    const trimmedStage = stage?.trim();

    if (!trimmedStage) {
      return undefined;
    }

    const normalizedStage = trimmedStage
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    const mappedStage = TASK_STAGE_ALIASES[normalizedStage] ?? normalizedStage;

    if (!TASK_STAGE_VALUES.has(mappedStage)) {
      throw new BadRequestException(
        `Unknown operation stage "${stage}".`,
      );
    }

    return mappedStage as OperationStage;
  }

  private buildTaskOrderBy(
    sortBy?: string,
    sortDirection?: string,
  ): Prisma.ProductOrderOperationOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder =
      sortDirection === 'desc' ? 'desc' : 'asc';

    switch (sortBy) {
      case 'due':
        return [
          { expectedTimeline: direction },
          { estimatedTimeMin: direction },
          { createdAt: 'desc' },
        ];
      case 'priority':
        return [
          { productOrder: { priority: direction } },
          { expectedTimeline: 'asc' },
          { createdAt: 'desc' },
        ];
      case 'stage':
        return [
          { operationStage: direction },
          { expectedTimeline: 'asc' },
          { createdAt: 'desc' },
        ];
      case 'order':
        return [
          { productOrder: { productName: direction } },
          { productOrder: { sku: direction } },
          { expectedTimeline: 'asc' },
          { createdAt: 'desc' },
        ];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  async listProductionOrder(id: string) {
    const productionOrder = await this.prisma.productOrder.findUnique({
      where: { id },
      include: {
        productOrderOperations: true,
        factoryWorkerActivities: {
          include: {
            location: true,
            supervisor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffId: true,
              },
            },
          },
          orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        },
        materials: {
          include: { inventory: { select: { itemName: true, sku: true } } },
        },
        operations: true,
        product: true,
      },
    });

    if (!productionOrder)
      throw new NotFoundException('Production order not found');

    const salesOrderLookup = await this.getSalesOrderLookup([
      productionOrder.zohoBooksId,
    ]);
    const orderWithTracking = this.attachSalesOrderTracking(
      productionOrder,
      salesOrderLookup,
    );
    const operationServices = buildOperationServiceSummary(
      productionOrder.productOrderOperations,
      productionOrder.quantity,
    );
    const factoryWorkerActivities = productionOrder.factoryWorkerActivities.map(
      (activity) => this.serializeFactoryWorkerActivity(activity),
    );
    const factoryLabourServices = buildFactoryLabourServiceSummary(
      factoryWorkerActivities,
    );

    return {
      ...orderWithTracking,
      factoryWorkerActivities,
      operationServices: [
        ...operationServices.items,
        ...factoryLabourServices.items,
      ],
      operationServicesTotal: operationServices.total,
      factoryLabourTotal: factoryLabourServices.total,
      productOrderOperations: productionOrder.productOrderOperations.map((op) =>
        this.enrichOperation(op),
      ),
    };
  }

  async createProductionOrder(data: CreateProductionOrderDto) {
    const {
      sku,
      productName,
      productId,
      productType,
      productCategory,
      quantity,
      orderType,
      priority,
      zohoBooksId,
      notes,
      status,
    } = data;

    return this.prisma.productOrder.create({
      data: {
        sku,
        productName,
        productId,
        productType,
        productCategory,
        quantity,
        orderType,
        priority,
        zohoBooksId,
        notes,
        ...(status ? { status } : {}),
      },
    });
  }

  async updateProductionOrder(id: string, data: UpdateProductionOrderDto) {
    const productionOrder = await this.getProductionOrderStatus(id);
    const updateData: UpdateProductionOrderDto = { ...data };

    const requestedLocationId =
      updateData.zohoLocationId?.trim() || productionOrder.zohoLocationId || '';

    if (
      (updateData.status === 'COMPLETE' ||
        updateData.status === 'PARTIALLY_COMPLETE') &&
      !requestedLocationId
    ) {
      throw new BadRequestException(
        'A Zoho location is required before marking this production order complete',
      );
    }

    if (requestedLocationId) {
      const location =
        await this.zohoSyncService.getZohoLocationById(requestedLocationId);

      if (!location) {
        throw new BadRequestException('Selected Zoho location is invalid');
      }

      updateData.zohoLocationId = String(location.location_id);
      updateData.zohoLocationName = location.location_name
        ? String(location.location_name)
        : undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productOrder.update({
        where: { id: productionOrder.id },
        data: updateData,
      });

      // Notify all users when a production order is completed
      if (
        updateData.status === 'COMPLETE' &&
        productionOrder.status !== 'COMPLETE'
      ) {
        const allUsers = await tx.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        this.notificationsService
          .createForMany(
            allUsers.map((u) => u.id),
            {
              type: 'PRODUCTION_COMPLETE',
              title: 'Production Order Completed',
              message: `Production order "${updated.productName}" (${updated.sku}) has been marked as complete.`,
              metadata: { orderId: updated.id, sku: updated.sku },
            },
          )
          .catch(() => {});
      }

      return updated;
    });
  }

  async deleteProductionOrder(id: string) {
    await this.assertOrderExists(id);
    // Explicitly delete associated Operation (task) rows first — productOrderId
    // is nullable with no cascade, so they would otherwise be orphaned.
    await this.prisma.operation.deleteMany({ where: { productOrderId: id } });
    return this.prisma.productOrder.delete({ where: { id } });
  }


  /**
   * Lightweight existence check — throws NotFoundException when the order is absent.
   * Use instead of listProductionOrder() in write paths that don't need the full payload.
   */
  private async assertOrderExists(id: string): Promise<void> {
    const exists = await this.prisma.productOrder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Production order not found');
  }

  /**
   * Lean read of the fields needed for status-change guards and audit logging.
   * Much faster than listProductionOrder() which loads all relations.
   */
  async getProductionOrderStatus(id: string) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        zohoLocationId: true,
        productName: true,
        sku: true,
      },
    });
    if (!order) throw new NotFoundException('Production order not found');
    return order;
  }

  private async getSalesOrderLookup(
    zohoBooksIds: Array<string | null | undefined>,
  ): Promise<Map<string, SalesOrderLookupRecord>> {
    const uniqueZohoBooksIds = [
      ...new Set(
        zohoBooksIds.filter(
          (zohoBooksId): zohoBooksId is string =>
            typeof zohoBooksId === 'string' && zohoBooksId.trim().length > 0,
        ),
      ),
    ];

    if (uniqueZohoBooksIds.length === 0) {
      return new Map<string, SalesOrderLookupRecord>();
    }

    const salesOrderModel = (
      this.prisma as unknown as {
        salesOrder?: {
          findMany: (args: {
            where: { zohoBooksId: { in: string[] } };
            select: {
              zohoBooksId: boolean;
              salesOrderNumber: boolean;
              customer: boolean;
            };
          }) => Promise<SalesOrderLookupRecord[]>;
        };
      }
    ).salesOrder;

    if (!salesOrderModel) {
      return new Map<string, SalesOrderLookupRecord>();
    }

    const salesOrders = await salesOrderModel.findMany({
      where: { zohoBooksId: { in: uniqueZohoBooksIds } },
      select: {
        zohoBooksId: true,
        salesOrderNumber: true,
        customer: true,
      },
    });

    return new Map(
      salesOrders.map((salesOrder) => [salesOrder.zohoBooksId, salesOrder]),
    );
  }

  private buildProductionReferenceId(
    salesOrderNumber: string,
    createdAt: Date | string,
  ) {
    const initiatedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(initiatedAt.getTime())) {
      return salesOrderNumber;
    }

    const pad = (value: number) => value.toString().padStart(2, '0');
    const timestamp = `${initiatedAt.getFullYear()}-${pad(
      initiatedAt.getMonth() + 1,
    )}-${pad(initiatedAt.getDate())}_${pad(initiatedAt.getHours())}-${pad(
      initiatedAt.getMinutes(),
    )}-${pad(initiatedAt.getSeconds())}`;

    return `${salesOrderNumber}-${timestamp}`;
  }

  private attachSalesOrderTracking<
    T extends { zohoBooksId?: string | null; createdAt: Date | string },
  >(
    productOrder: T,
    salesOrderLookup: Map<string, SalesOrderLookupRecord>,
  ): ProductOrderWithTracking<T> {
    const salesOrder = productOrder.zohoBooksId
      ? salesOrderLookup.get(productOrder.zohoBooksId)
      : undefined;
    const salesOrderNumber = salesOrder?.salesOrderNumber ?? null;
    const salesOrderCustomerName = salesOrder?.customer ?? null;

    return {
      ...productOrder,
      salesOrderNumber,
      salesOrderCustomerName,
      referenceId: salesOrderNumber
        ? this.buildProductionReferenceId(
            salesOrderNumber,
            productOrder.createdAt,
          )
        : null,
    };
  }
  async bulkDeleteProductionOrders(ids: string[]) {
    if (!Array.isArray(ids))
      throw new BadRequestException('ids must be an array');
    if (ids.length === 0) return { deleted: 0 };

    try {
      // Delete associated Operation (task) rows first for all orders in one query,
      // then delete the orders themselves in a transaction.
      await this.prisma.operation.deleteMany({
        where: { productOrderId: { in: ids } },
      });
      const res = await this.prisma.$transaction(
        ids.map((id) => this.prisma.productOrder.delete({ where: { id } })),
      );
      return { deleted: res.length };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error bulk deleting production orders',
      );
    }
  }

  async upsertOperation(
    productOrderId: string,
    data: UpsertOperationDto,
  ): Promise<
    ProductOrderOperation & {
      cuttingPreview?: ReturnType<typeof calculateCuttingMetrics>;
    }
  > {
    await this.assertOrderExists(productOrderId); // throws if not found

    const { operationStage, id, ...fields } = data;

    return this.prisma.$transaction(async (tx) => {
      let op: ProductOrderOperation;
      let syncPaperMaterials = false;
      let stalePaperInventoryId: string | null = null;

      // If id provided, update that exact operation
      if (id) {
        const existingById = await tx.productOrderOperation.findUnique({
          where: { id },
        });
        if (!existingById || existingById.productOrderId !== productOrderId) {
          throw new NotFoundException('Operation not found');
        }
        const resolvedFields = this.resolveOperationFields({
          ...existingById,
          ...fields,
        });
        await this.validateTaskStartPrerequisites(
          tx,
          productOrderId,
          existingById.operationStage,
          existingById.stageStatus,
          resolvedFields['stageStatus'] as string | undefined,
        );
        await this.applyCompletionQuantityDefaults(
          tx,
          productOrderId,
          existingById.operationStage,
          resolvedFields,
        );
        this.applyAutoPartialStatus(resolvedFields);
        this.applyStatusTimestamps(
          resolvedFields,
          existingById.stageStatus,
          existingById.startedAt,
        );
        await this.validateCuttingOperation(tx, productOrderId, {
          ...existingById,
          ...resolvedFields,
        });
        const nextInventoryId =
          typeof resolvedFields.inventoryId === 'string'
            ? resolvedFields.inventoryId
            : existingById.inventoryId;
        if (
          existingById.operationStage === 'PAPER_SELECTION' &&
          existingById.inventoryId &&
          existingById.inventoryId !== nextInventoryId
        ) {
          stalePaperInventoryId = existingById.inventoryId;
        }
        op = await tx.productOrderOperation.update({
          where: { id },
          data: resolvedFields,
        });
        syncPaperMaterials =
          existingById.operationStage === 'PAPER_SELECTION' ||
          existingById.operationStage === 'CUTTING';
      } else if (
        operationStage === 'CUTTING' ||
        operationStage === 'PAPER_SELECTION'
      ) {
        // For CUTTING: look for an existing cutting op linked to the same paper selection
        // For PAPER_SELECTION: look for an existing paper selection op on this order
        // (with optional inventoryId match to avoid merging distinct paper selections)
        let existingLinkedCuttingOperation: Awaited<
          ReturnType<typeof tx.productOrderOperation.findFirst>
        > = null;

        if (
          operationStage === 'CUTTING' &&
          typeof fields.paperSelectionOpId === 'string' &&
          fields.paperSelectionOpId.trim().length > 0
        ) {
          existingLinkedCuttingOperation =
            await tx.productOrderOperation.findFirst({
              where: {
                productOrderId,
                operationStage: 'CUTTING',
                paperSelectionOpId: fields.paperSelectionOpId,
              },
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            });
        } else if (operationStage === 'PAPER_SELECTION') {
          // Match by inventoryId if provided, otherwise find any existing paper selection
          const psWhere: Prisma.ProductOrderOperationWhereInput = {
            productOrderId,
            operationStage: 'PAPER_SELECTION',
          };
          if (
            typeof fields.inventoryId === 'string' &&
            fields.inventoryId.trim().length > 0
          ) {
            psWhere.inventoryId = fields.inventoryId;
          }
          existingLinkedCuttingOperation =
            await tx.productOrderOperation.findFirst({
              where: psWhere,
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            });
        }

        const resolvedFields = this.resolveOperationFields({
          ...(existingLinkedCuttingOperation ?? {}),
          ...fields,
        });
        await this.validateTaskStartPrerequisites(
          tx,
          productOrderId,
          operationStage,
          existingLinkedCuttingOperation?.stageStatus ?? null,
          resolvedFields['stageStatus'] as string | undefined,
        );
        await this.applyCompletionQuantityDefaults(
          tx,
          productOrderId,
          operationStage,
          resolvedFields,
        );
        this.applyAutoPartialStatus(resolvedFields);
        this.applyStatusTimestamps(
          resolvedFields,
          existingLinkedCuttingOperation?.stageStatus ?? null,
          existingLinkedCuttingOperation?.startedAt ?? null,
        );
        await this.validateCuttingOperation(tx, productOrderId, {
          ...(existingLinkedCuttingOperation ?? { operationStage }),
          ...resolvedFields,
        });
        if (existingLinkedCuttingOperation) {
          op = await tx.productOrderOperation.update({
            where: { id: existingLinkedCuttingOperation.id },
            data: resolvedFields,
          });
        } else {
          op = await tx.productOrderOperation.create({
            data: { productOrderId, operationStage, ...resolvedFields },
          });
        }
        syncPaperMaterials = true;
      } else {
        // For non-cutting stages, try to find an existing operation and update it, otherwise create
        const existingOperation = await tx.productOrderOperation.findFirst({
          where: {
            productOrderId,
            operationStage: operationStage,
          },
        });
        const resolvedFields = this.resolveOperationFields({
          ...(existingOperation ?? {}),
          ...fields,
        });
        await this.validateTaskStartPrerequisites(
          tx,
          productOrderId,
          operationStage,
          existingOperation?.stageStatus ?? null,
          resolvedFields['stageStatus'] as string | undefined,
        );
        await this.applyCompletionQuantityDefaults(
          tx,
          productOrderId,
          operationStage,
          resolvedFields,
        );
        this.applyAutoPartialStatus(resolvedFields);
        this.applyStatusTimestamps(
          resolvedFields,
          existingOperation?.stageStatus ?? null,
          existingOperation?.startedAt ?? null,
        );
        await this.validateCuttingOperation(tx, productOrderId, {
          ...(existingOperation ?? { operationStage }),
          ...resolvedFields,
        });
        if (existingOperation) {
          op = await tx.productOrderOperation.update({
            where: { id: existingOperation.id },
            data: resolvedFields,
          });
        } else {
          op = await tx.productOrderOperation.create({
            data: { productOrderId, operationStage, ...resolvedFields },
          });
        }
      }

      if (syncPaperMaterials) {
        await this.syncPaperSelectionMaterials(tx, productOrderId, {
          staleInventoryId: stalePaperInventoryId,
        });
        await this.syncCompletedOperationQuantities(tx, productOrderId);
      }

      // Recalculate grandTotal = subtotal + labourCost + operation derived costs
      await this.recalcTotals(tx, productOrderId);

      // Notify assigned staff member
      if (op.assignedStaffId && data.assignedStaffId) {
        const order = await tx.productOrder.findUnique({
          where: { id: productOrderId },
          select: { productName: true, sku: true },
        });
        this.notificationsService
          .create({
            userId: op.assignedStaffId,
            type: 'TASK_ASSIGNED',
            title: 'New Task Assigned',
            message: `You have been assigned to ${operationStage.replace(/_/g, ' ')} for "${order?.productName ?? ''}" (${order?.sku ?? ''}).`,
            metadata: { orderId: productOrderId, operationId: op.id, stage: operationStage },
          })
          .catch(() => {});
      }

      return this.enrichOperation(op);
    });
  }

  async getProductionRules() {
    const inventoryItems = await this.prisma.inventory.findMany({
      orderBy: [{ itemType: 'asc' }, { itemName: 'asc' }],
      select: {
        id: true,
        sku: true,
        itemName: true,
        itemType: true,
        category: true,
        quantityInStock: true,
        averagePrice: true,
        price: true,
      },
    });

    const paperRules = inventoryItems
      .filter(
        (item) =>
          typeof item.itemType === 'string' &&
          item.itemType.toLowerCase() === 'paper',
      )
      .map((item) => buildPaperRuleFromInventoryItem(item))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return getProductionRules(paperRules);
  }

  async previewCutting(
    paperSize?: string,
    cutSize?: string,
    costPerSheet?: string,
    requestedCuts?: string,
    productOrderId?: string,
    inventoryId?: string,
    operationId?: string,
    quantityOfSheetsTaken?: string,
  ) {
    if (!paperSize || !cutSize) {
      throw new BadRequestException('paperSize and cutSize are required');
    }

    const parsedCostPerSheet =
      costPerSheet !== undefined ? Number(costPerSheet) : undefined;
    const parsedRequestedCuts =
      requestedCuts !== undefined && requestedCuts !== ''
        ? Number(requestedCuts)
        : undefined;
    const parsedQuantityOfSheetsTaken =
      quantityOfSheetsTaken !== undefined && quantityOfSheetsTaken !== ''
        ? Number(quantityOfSheetsTaken)
        : undefined;

    if (
      costPerSheet !== undefined &&
      (parsedCostPerSheet === undefined ||
        !Number.isFinite(parsedCostPerSheet) ||
        parsedCostPerSheet <= 0)
    ) {
      throw new BadRequestException('costPerSheet must be a positive number');
    }

    if (
      requestedCuts !== undefined &&
      requestedCuts !== '' &&
      (parsedRequestedCuts === undefined ||
        !Number.isFinite(parsedRequestedCuts) ||
        !Number.isInteger(parsedRequestedCuts) ||
        parsedRequestedCuts < 0)
    ) {
      throw new BadRequestException('requestedCuts must be a whole number');
    }

    if (
      quantityOfSheetsTaken !== undefined &&
      quantityOfSheetsTaken !== '' &&
      (parsedQuantityOfSheetsTaken === undefined ||
        !Number.isFinite(parsedQuantityOfSheetsTaken) ||
        !Number.isInteger(parsedQuantityOfSheetsTaken) ||
        parsedQuantityOfSheetsTaken < 1)
    ) {
      throw new BadRequestException(
        'quantityOfSheetsTaken must be a positive whole number',
      );
    }

    const cuttingMetrics = calculateCuttingMetrics(
      paperSize,
      cutSize,
      parsedCostPerSheet,
    );
    const selectedSheetQuantity =
      parsedQuantityOfSheetsTaken !== undefined
        ? parsedQuantityOfSheetsTaken
        : null;
    const requestedCutsValue =
      parsedRequestedCuts !== undefined
        ? parsedRequestedCuts
        : selectedSheetQuantity !== null
          ? selectedSheetQuantity * cuttingMetrics.maxCutOutsPerSheet
          : null;
    const sheetFractionUsed =
      requestedCutsValue !== null
        ? calculateSheetFractionUsed(
            requestedCutsValue,
            cuttingMetrics.maxCutOutsPerSheet,
          )
        : null;
    const remainingCutCapacity =
      requestedCutsValue !== null
        ? calculateRemainingCutCapacity(
            cuttingMetrics.maxCutOutsPerSheet,
            requestedCutsValue,
          )
        : null;
    // requestedCuts is now total cuts (sheets × maxCutOutsPerSheet), not per-sheet.
    // The per-sheet geometric limit is enforced by always defaulting to max cuts.
    // Availability is handled by exceedsRemainingPaper.
    const exceedsMaxCutOuts = false;

    let usedSheetsOnOrder: number | null = null;
    let remainingSheetsOnOrder: number | null = null;
    let remainingCutsForThisSizeOnOrder: number | null = null;
    let sourcePaperQuantityPlanned: number | null = null;
    let exceedsRemainingPaper = false;

    if (selectedSheetQuantity !== null) {
      sourcePaperQuantityPlanned = selectedSheetQuantity;
      usedSheetsOnOrder = 0;

      if (requestedCutsValue !== null) {
        const projectedUsedSheets = sheetFractionUsed ?? 0;
        exceedsRemainingPaper =
          projectedUsedSheets > selectedSheetQuantity + 0.0001;
        remainingSheetsOnOrder = Number(
          Math.max(selectedSheetQuantity - projectedUsedSheets, 0).toFixed(4),
        );
        remainingCutsForThisSizeOnOrder = Math.floor(
          remainingSheetsOnOrder * cuttingMetrics.cutOuts,
        );
      } else {
        remainingSheetsOnOrder = selectedSheetQuantity;
        remainingCutsForThisSizeOnOrder =
          selectedSheetQuantity * cuttingMetrics.cutOuts;
      }
    } else if (productOrderId) {
      const orderCuttingState = await this.getCuttingStateForPaper({
        productOrderId,
        inventoryId,
        paperSize,
        excludeOperationId: operationId,
        excludePaperSelectionOpId: operationId,
      });
      const productOrder =
        orderCuttingState.materialQuantity === null ||
        orderCuttingState.materialQuantity <= 0
          ? await this.prisma.productOrder.findUnique({
              where: { id: productOrderId },
              select: { quantity: true },
            })
          : null;

      sourcePaperQuantityPlanned =
        orderCuttingState.materialQuantity !== null &&
        orderCuttingState.materialQuantity > 0
          ? orderCuttingState.materialQuantity
          : productOrder
            ? calculateSourceSheetsRequired(
                productOrder.quantity,
                cuttingMetrics.maxCutOutsPerSheet,
              )
            : null;
      usedSheetsOnOrder = orderCuttingState.usedSheets;

      if (requestedCutsValue !== null) {
        const projectedUsedSheets =
          orderCuttingState.usedSheets + (sheetFractionUsed ?? 0);
        exceedsRemainingPaper =
          sourcePaperQuantityPlanned !== null &&
          projectedUsedSheets > sourcePaperQuantityPlanned + 0.0001;
        remainingSheetsOnOrder =
          sourcePaperQuantityPlanned !== null
            ? Number(
                Math.max(
                  sourcePaperQuantityPlanned - projectedUsedSheets,
                  0,
                ).toFixed(4),
              )
            : null;
        remainingCutsForThisSizeOnOrder =
          remainingSheetsOnOrder !== null
            ? Math.floor(remainingSheetsOnOrder * cuttingMetrics.cutOuts)
            : null;
      } else if (sourcePaperQuantityPlanned !== null) {
        remainingSheetsOnOrder = Number(
          Math.max(
            sourcePaperQuantityPlanned - orderCuttingState.usedSheets,
            0,
          ).toFixed(4),
        );
        remainingCutsForThisSizeOnOrder = Math.floor(
          remainingSheetsOnOrder * cuttingMetrics.cutOuts,
        );
      }
    }

    return {
      ...cuttingMetrics,
      requestedCuts: requestedCutsValue,
      sheetFractionUsed,
      remainingCutCapacity,
      exceedsMaxCutOuts,
      exceedsRemainingPaper,
      usedSheetsOnOrder,
      remainingSheetsOnOrder,
      remainingCutsForThisSizeOnOrder,
      sourcePaperQuantityPlanned,
      selectedSourceSheets: selectedSheetQuantity,
      totalCutoutsFromSelectedSheets:
        selectedSheetQuantity !== null
          ? selectedSheetQuantity * cuttingMetrics.cutOuts
          : null,
    };
  }

  private toNumber(value?: number | string | { toString(): string } | null) {
    if (value === null || value === undefined) {
      return undefined;
    }

    const parsed =
      typeof value === 'number' ? value : Number(value.toString().trim());

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private buildMaterialTotals(
    quantity: number,
    unitPrice: number,
    quantityUsed = 0,
  ) {
    const safeQuantity =
      Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    const safeUnitPrice =
      Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
    const safeQuantityUsed =
      Number.isFinite(quantityUsed) && quantityUsed > 0 ? quantityUsed : 0;

    return {
      quantity: safeQuantity.toFixed(4),
      quantityUsed: safeQuantityUsed.toFixed(4),
      unitPrice: safeUnitPrice.toFixed(2),
      lineTotal: (safeQuantity * safeUnitPrice).toFixed(2),
      endTotal: (
        Math.max(safeQuantity - safeQuantityUsed, 0) * safeUnitPrice
      ).toFixed(2),
    };
  }

  private cuttingOperationMatchesPaper(
    cuttingOperation: {
      paperSelectionOpId?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
    },
    paperSelection: {
      id?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
    },
  ) {
    if (cuttingOperation.paperSelectionOpId) {
      return (
        !!paperSelection.id &&
        cuttingOperation.paperSelectionOpId === paperSelection.id
      );
    }

    if (
      cuttingOperation.inventoryId &&
      paperSelection.inventoryId &&
      cuttingOperation.inventoryId === paperSelection.inventoryId
    ) {
      return true;
    }

    const cuttingPaperSize = normalizeSize(cuttingOperation.paperSize);
    const selectionPaperSize = normalizeSize(paperSelection.paperSize);

    return !!cuttingPaperSize && !!selectionPaperSize
      ? cuttingPaperSize === selectionPaperSize
      : false;
  }

  private findCascadeCuttingOperationForPaperSelection(
    paperSelection: {
      id?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
    },
    cuttingOperations: Array<{
      id?: string | null;
      paperSelectionOpId?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
      cutSize?: string | null;
      cutQuantity?: number | null;
    }>,
  ) {
    if (paperSelection.id) {
      const linkedOperation = cuttingOperations.find(
        (operation) => operation.paperSelectionOpId === paperSelection.id,
      );

      if (linkedOperation) {
        return linkedOperation;
      }
    }

    const matchingUnlinkedOperations = cuttingOperations.filter(
      (operation) =>
        !operation.paperSelectionOpId &&
        this.cuttingOperationMatchesPaper(operation, paperSelection),
    );

    return matchingUnlinkedOperations.length === 1
      ? matchingUnlinkedOperations[0]
      : null;
  }

  private calculateCuttingOperationSheetUsage(operation: {
    paperSize?: string | null;
    cutSize?: string | null;
    cutQuantity?: number | null;
  }) {
    if (!operation.paperSize || !operation.cutSize || !operation.cutQuantity) {
      return 0;
    }

    const cuttingMetrics = calculateCuttingMetrics(
      operation.paperSize,
      operation.cutSize,
    );

    return calculateSheetFractionUsed(
      operation.cutQuantity,
      cuttingMetrics.maxCutOutsPerSheet,
    );
  }

  private async getCuttingStateForPaper(params: {
    productOrderId: string;
    inventoryId?: string;
    paperSize?: string;
    excludeOperationId?: string;
    excludePaperSelectionOpId?: string;
  }) {
    const [cuttingOperations, materials] = await Promise.all([
      this.prisma.productOrderOperation.findMany({
        where: {
          productOrderId: params.productOrderId,
          operationStage: 'CUTTING',
          ...(params.excludeOperationId
            ? { id: { not: params.excludeOperationId } }
            : {}),
          ...(params.excludePaperSelectionOpId
            ? {
                paperSelectionOpId: {
                  not: params.excludePaperSelectionOpId,
                },
              }
            : {}),
        },
      }),
      this.prisma.productOrderMaterial.findMany({
        where: { productOrderId: params.productOrderId },
      }),
    ]);

    const matchingCuttingOperations = cuttingOperations.filter((operation) => {
      if (params.inventoryId && operation.inventoryId === params.inventoryId) {
        return true;
      }

      return (
        !!params.paperSize &&
        normalizeSize(operation.paperSize) === normalizeSize(params.paperSize)
      );
    });

    const usedSheets = Number(
      matchingCuttingOperations
        .reduce(
          (sum, operation) =>
            sum + this.calculateCuttingOperationSheetUsage(operation),
          0,
        )
        .toFixed(4),
    );

    const matchingMaterial = params.inventoryId
      ? materials.find(
          (material) => material.inventoryId === params.inventoryId,
        )
      : undefined;

    return {
      usedSheets,
      materialQuantity:
        matchingMaterial !== undefined
          ? (this.toNumber(matchingMaterial.quantity) ?? null)
          : null,
    };
  }

  private pickCuttingOperationForPaperSelection(
    paperSelection: {
      id?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
    },
    cuttingOperations: Array<{
      paperSelectionOpId?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
      cutSize?: string | null;
      cutQuantity?: number | null;
    }>,
  ) {
    const linkedOperation = this.findCascadeCuttingOperationForPaperSelection(
      paperSelection,
      cuttingOperations,
    );

    if (linkedOperation) {
      return linkedOperation;
    }

    const unlinkedOperations = cuttingOperations.filter(
      (operation) => !operation.paperSelectionOpId,
    );

    if (paperSelection.inventoryId || paperSelection.paperSize) {
      const matched = unlinkedOperations.find((operation) =>
        this.cuttingOperationMatchesPaper(operation, paperSelection),
      );
      if (matched) {
        return matched;
      }
    }

    if (unlinkedOperations.length === 1) {
      return unlinkedOperations[0];
    }

    return (
      unlinkedOperations.find(
        (operation) => !!operation.cutSize || !!operation.cutQuantity,
      ) ?? null
    );
  }

  private async syncPaperSelectionMaterials(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
    options?: {
      staleInventoryId?: string | null;
    },
  ) {
    const productOrder = await tx.productOrder.findUnique({
      where: { id: productOrderId },
      select: { quantity: true },
    });

    if (!productOrder) {
      throw new NotFoundException('Production order not found');
    }

    const paperSelections = await tx.productOrderOperation.findMany({
      where: {
        productOrderId,
        operationStage: 'PAPER_SELECTION',
        inventoryId: { not: null },
      },
      include: {
        inventory: {
          select: {
            id: true,
            itemName: true,
            averagePrice: true,
            itemType: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const cuttingOperations = await tx.productOrderOperation.findMany({
      where: {
        productOrderId,
        operationStage: 'CUTTING',
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const activePaperInventoryIds = new Set(
      paperSelections
        .map((selection) => selection.inventoryId)
        .filter((inventoryId): inventoryId is string => !!inventoryId),
    );

    const plannedMaterials = new Map<
      string,
      {
        quantity: number;
        quantityUsed: number;
        unitPrice: number;
      }
    >();

    for (const selection of paperSelections) {
      if (!selection.inventoryId || !selection.inventory) {
        continue;
      }

      let sourceSheetSize =
        selection.paperSize ??
        extractSourceSheetSize(selection.inventory.itemName) ??
        undefined;
      let cutSize = selection.cutSize ?? undefined;
      let cutOuts: number | undefined;
      const matchingCuttingOperations = cuttingOperations.filter((operation) =>
        this.cuttingOperationMatchesPaper(operation, selection),
      );

      if (!cutSize) {
        const cuttingOperation = this.pickCuttingOperationForPaperSelection(
          selection,
          matchingCuttingOperations,
        );

        if (cuttingOperation) {
          sourceSheetSize =
            sourceSheetSize ?? cuttingOperation.paperSize ?? undefined;
          cutSize = cutSize ?? cuttingOperation.cutSize ?? undefined;
        }
      }

      if ((!cutOuts || cutOuts < 1) && sourceSheetSize && cutSize) {
        try {
          cutOuts = calculateCuttingMetrics(sourceSheetSize, cutSize).cutOuts;
        } catch {
          cutOuts = undefined;
        }
      }

      const requiredSheets =
        cutOuts && cutOuts > 0
          ? calculateSourceSheetsRequired(productOrder.quantity, cutOuts)
          : 0;
      const quantityUsed = Number(
        matchingCuttingOperations
          .reduce(
            (sum, operation) =>
              sum + this.calculateCuttingOperationSheetUsage(operation),
            0,
          )
          .toFixed(4),
      );
      const unitPrice =
        this.toNumber(selection.costPerSheet) ??
        this.toNumber(selection.inventory.averagePrice) ??
        0;

      const existingPlan = plannedMaterials.get(selection.inventoryId);
      if (existingPlan) {
        existingPlan.quantity += requiredSheets;
        existingPlan.quantityUsed += quantityUsed;
        if (existingPlan.unitPrice <= 0 && unitPrice > 0) {
          existingPlan.unitPrice = unitPrice;
        }
        continue;
      }

      plannedMaterials.set(selection.inventoryId, {
        quantity: Math.max(requiredSheets, quantityUsed),
        quantityUsed,
        unitPrice,
      });
    }

    for (const [inventoryId, plannedMaterial] of plannedMaterials.entries()) {
      const existingMaterial = await tx.productOrderMaterial.findFirst({
        where: {
          productOrderId,
          inventoryId,
        },
      });

      if (existingMaterial) {
        const existingQuantity = this.toNumber(existingMaterial.quantity) ?? 0;
        await tx.productOrderMaterial.update({
          where: { id: existingMaterial.id },
          data: this.buildMaterialTotals(
            Math.max(plannedMaterial.quantity, existingQuantity),
            plannedMaterial.unitPrice,
            plannedMaterial.quantityUsed,
          ),
        });
        continue;
      }

      await tx.productOrderMaterial.create({
        data: {
          productOrderId,
          inventoryId,
          ...this.buildMaterialTotals(
            plannedMaterial.quantity,
            plannedMaterial.unitPrice,
            plannedMaterial.quantityUsed,
          ),
        },
      });
    }

    if (
      options?.staleInventoryId &&
      !activePaperInventoryIds.has(options.staleInventoryId)
    ) {
      const staleMaterial = await tx.productOrderMaterial.findFirst({
        where: {
          productOrderId,
          inventoryId: options.staleInventoryId,
        },
        include: {
          inventory: {
            select: {
              itemType: true,
            },
          },
        },
      });

      if (
        staleMaterial &&
        typeof staleMaterial.inventory.itemType === 'string' &&
        staleMaterial.inventory.itemType.toLowerCase() === 'paper'
      ) {
        await tx.productOrderMaterial.delete({
          where: { id: staleMaterial.id },
        });
      }
    }
  }

  private async recalcTotals(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
  ) {
    const materials = await tx.productOrderMaterial.findMany({
      where: { productOrderId },
      include: {
        inventory: {
          select: {
            itemType: true,
          },
        },
      },
    });
    const subtotal = materials.reduce(
      (sum, m) => sum + parseFloat(m.lineTotal.toString()),
      0,
    );
    const hasPaperMaterial = materials.some(
      (material) =>
        typeof material.inventory?.itemType === 'string' &&
        material.inventory.itemType.toLowerCase() === 'paper',
    );

    const operations = await tx.productOrderOperation.findMany({
      where: { productOrderId },
    });
    const operationLabourCost = operations.reduce(
      (sum, op) => sum + parseFloat((op.labourCost ?? 0).toString()),
      0,
    );
    const factoryWorkerActivities = await tx.factoryWorkerActivity.findMany({
      where: { productOrderId },
      select: {
        id: true,
        workDate: true,
        typeOfFinishing: true,
        quantityAllocated: true,
        quantityFinished: true,
        costPerFinish: true,
      },
    });

    const productOrder = await tx.productOrder.findUnique({
      where: { id: productOrderId },
      select: { quantity: true },
    });
    const orderQuantity = productOrder?.quantity ?? 0;

    const operationServices = buildOperationServiceSummary(
      operations,
      orderQuantity,
    );
    const factoryLabourServices = buildFactoryLabourServiceSummary(
      factoryWorkerActivities,
    );
    const labourCost = operationLabourCost + factoryLabourServices.total;

    let derivedPaperCost = 0;
    for (const op of operations) {
      // If paper is already tracked as a material line, do not count it again here.
      if (
        !hasPaperMaterial &&
        op.paperSize &&
        op.cutSize &&
        op.costPerSheet !== null &&
        op.costPerSheet !== undefined
      ) {
        try {
          const parsedCostPerSheet = Number(op.costPerSheet.toString());
          if (Number.isFinite(parsedCostPerSheet) && parsedCostPerSheet > 0) {
            const metrics = calculateCuttingMetrics(
              op.paperSize,
              op.cutSize,
              parsedCostPerSheet,
            );
            if (metrics.costOfPaperUsed != null) {
              derivedPaperCost += metrics.costOfPaperUsed * orderQuantity;
            }
          }
        } catch {
          // ignore invalid metrics
        }
      }
    }

    const newSubtotal = subtotal + operationServices.total + derivedPaperCost;

    const grandTotal = newSubtotal + labourCost;

    await tx.productOrder.update({
      where: { id: productOrderId },
      data: {
        subtotal: newSubtotal.toFixed(2),
        labourCost: labourCost.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
      },
    });
  }

  async addMaterial(productOrderId: string, data: AddMaterialDto) {
    await this.assertOrderExists(productOrderId);

    const qty = parseFloat(data.quantity);
    const unit = parseFloat(data.unitPrice);
    // lineTotal = quantity × unitPrice
    const lt = (qty * unit).toFixed(2);
    // endTotal = (quantity - quantityUsed) × unitPrice  (quantityUsed starts at 0)
    const et = lt;

    let inventoryRecord = await this.prisma.inventory.findUnique({
      where: { id: data.inventoryId },
    });

    if (!inventoryRecord) {
      try {
        inventoryRecord = await this.prisma.inventory.findUnique({
          where: { sku: data.inventoryId },
        });
      } catch {
        //
      }
    }

    if (!inventoryRecord) {
      const zohoItem = await this.zohoSyncService.getZohoItemById(
        data.inventoryId,
      );
      if (zohoItem) {
        const sku =
          typeof zohoItem.sku === 'string' && zohoItem.sku.trim().length > 0
            ? zohoItem.sku.trim()
            : `ZOHO-${zohoItem.itemId ?? ''}`;
        const itemName = zohoItem.itemName ?? zohoItem.name ?? 'Unknown';

        // Check again by SKU (unique) using the main client
        inventoryRecord = await this.prisma.inventory.findUnique({
          where: { sku },
        });

        if (!inventoryRecord) {
          try {
            inventoryRecord = await this.prisma.inventory.create({
              data: {
                sku,
                itemName,
                itemType: 'MATERIAL',
                category: 'UNCATEGORIZED',
                quantityInStock: Math.round(zohoItem.stockOnHand ?? 0),
                averagePrice: zohoItem.purchaseRate ?? 0,
                price: zohoItem.rate ?? 0,
                receivedDate: new Date(),
              },
            });
          } catch {
            // If a concurrent request created the inventory first, re-fetch it
            inventoryRecord = await this.prisma.inventory.findUnique({
              where: { sku },
            });
          }
        }
      }
    }

    if (!inventoryRecord) {
      throw new BadRequestException('Invalid inventoryId');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingMaterial = await tx.productOrderMaterial.findFirst({
        where: {
          productOrderId,
          inventoryId: inventoryRecord.id,
        },
        include: { inventory: { select: { itemName: true, sku: true } } },
      });

      if (existingMaterial) {
        const label =
          existingMaterial.inventory?.itemName ??
          inventoryRecord.itemName ??
          inventoryRecord.sku;
        throw new BadRequestException(
          `Material "${label}" is already added to this production order`,
        );
      }

      const material = await tx.productOrderMaterial.create({
        data: {
          productOrderId,
          inventoryId: inventoryRecord.id,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          lineTotal: lt,
          endTotal: et,
        },
        include: { inventory: { select: { itemName: true, sku: true } } },
      });

      await this.recalcTotals(tx, productOrderId);
      return material;
    });
  }

  async updateMaterialUsage(
    productOrderId: string,
    materialId: string,
    quantityUsed: string,
  ) {
    await this.assertOrderExists(productOrderId);

    const material = await this.prisma.productOrderMaterial.findFirst({
      where: { id: materialId, productOrderId },
    });
    if (!material) throw new NotFoundException('Material not found');

    const qty = parseFloat(material.quantity.toString());
    const used = parseFloat(quantityUsed);
    const unit = parseFloat(material.unitPrice.toString());
    const endTotal = ((qty - used) * unit).toFixed(2);

    return this.prisma.productOrderMaterial.update({
      where: { id: materialId },
      data: { quantityUsed, endTotal },
    });
  }

  async repeatProductionOrder(id: string) {
    const src = await this.listProductionOrder(id);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.productOrder.create({
        data: {
          sku: src.sku,
          productName: src.productName,
          productId: src.productId,
          productType: src.productType,
          productCategory: src.productCategory,
          quantity: src.quantity,
          orderType: src.orderType,
          priority: src.priority,
          zohoBooksId: src.zohoBooksId,
          notes: src.notes,
          status: 'PENDING',
        },
      });

      const materials = src.materials as ProductOrderMaterial[] | undefined;
      if (Array.isArray(materials) && materials.length > 0) {
        for (const m of materials) {
          await tx.productOrderMaterial.create({
            data: {
              productOrderId: created.id,
              inventoryId: m.inventoryId,
              quantity: m.quantity,
              quantityUsed: m.quantityUsed ?? 0,
              unitPrice: m.unitPrice,
              lineTotal: m.lineTotal,
              endTotal: m.endTotal,
            },
          });
        }
      }

      const productOrderOperations = src.productOrderOperations as
        | ProductOrderOperation[]
        | undefined;
      if (
        Array.isArray(productOrderOperations) &&
        productOrderOperations.length > 0
      ) {
        for (const op of productOrderOperations) {
          await tx.productOrderOperation.create({
            data: {
              productOrderId: created.id,
              operationStage: op.operationStage,
              inventoryId: op.inventoryId ?? undefined,
              assignedStaffId: op.assignedStaffId ?? undefined,

              paperSize: op.paperSize ?? undefined,
              sheetsPerPacket: op.sheetsPerPacket ?? undefined,
              costPerPacket: op.costPerPacket ?? undefined,
              costPerSheet: op.costPerSheet ?? undefined,

              cutSize: op.cutSize ?? undefined,
              cutQuantity: op.cutQuantity ?? undefined,
              costPerCut: op.costPerCut ?? undefined,

              ctpMachine: op.ctpMachine ?? undefined,
              ctpCostPerColor: op.ctpCostPerColor ?? undefined,

              printMachine: op.printMachine ?? undefined,
              printCostPerColor: op.printCostPerColor ?? undefined,

              laminationType: op.laminationType ?? undefined,
              laminationSize: op.laminationSize ?? undefined,
              glossCost: op.glossCost ?? undefined,
              matteCost: op.matteCost ?? undefined,

              diecutSize: op.diecutSize ?? undefined,
              costPerDiecut: op.costPerDiecut ?? undefined,

              itemFinished: op.itemFinished ?? undefined,
              finishingLocation: op.finishingLocation ?? undefined,
              twistedHandles: op.twistedHandles ?? undefined,
              costPerFinish: op.costPerFinish ?? undefined,

              operationName: op.operationName ?? undefined,
              quantityWasted: op.quantityWasted ?? undefined,
              estimatedTimeMin: op.estimatedTimeMin ?? undefined,
              labourCost: op.labourCost ?? undefined,
            },
          });
        }
      }

      await this.recalcTotals(tx, created.id);

      const newOrder = await tx.productOrder.findUnique({
        where: { id: created.id },
        include: {
          productOrderOperations: true,
          materials: {
            include: { inventory: { select: { itemName: true, sku: true } } },
          },
          operations: true,
          product: true,
        },
      });

      if (!newOrder)
        throw new InternalServerErrorException(
          'Failed to create repeated production order',
        );

      return {
        ...newOrder,
        productOrderOperations: newOrder.productOrderOperations.map((op) =>
          this.enrichOperation(op),
        ),
      };
    });
  }

  async removeMaterial(productOrderId: string, materialId: string) {
    await this.assertOrderExists(productOrderId);

    const material = await this.prisma.productOrderMaterial.findFirst({
      where: { id: materialId, productOrderId },
    });
    if (!material) throw new NotFoundException('Material not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.productOrderMaterial.delete({ where: { id: materialId } });
      await this.recalcTotals(tx, productOrderId);
    });
    return { deleted: true };
  }

  async deleteOperation(productOrderId: string, operationId: string) {
    await this.assertOrderExists(productOrderId);

    const operation = await this.prisma.productOrderOperation.findFirst({
      where: { id: operationId, productOrderId },
    });
    if (!operation) throw new NotFoundException('Operation not found');

    if (
      operation.stageStatus === 'IN_PROGRESS' ||
      operation.stageStatus === 'COMPLETE'
    ) {
      throw new BadRequestException(
        'Cannot delete an operation that is in progress or complete',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      let staleInventoryId = operation.inventoryId ?? null;

      if (operation.operationStage === 'PAPER_SELECTION') {
        const cuttingOperations = await tx.productOrderOperation.findMany({
          where: {
            productOrderId,
            operationStage: 'CUTTING',
          },
        });

        const linkedCuttingOperation =
          this.findCascadeCuttingOperationForPaperSelection(
            operation,
            cuttingOperations,
          );

        if (linkedCuttingOperation?.id) {
          staleInventoryId =
            staleInventoryId ?? (linkedCuttingOperation.inventoryId ?? null);
          await tx.productOrderOperation.delete({
            where: { id: linkedCuttingOperation.id },
          });
        }
      }

      await tx.productOrderOperation.delete({ where: { id: operationId } });

      if (
        operation.operationStage === 'PAPER_SELECTION' ||
        operation.operationStage === 'CUTTING'
      ) {
        await this.syncPaperSelectionMaterials(tx, productOrderId, {
          staleInventoryId,
        });
      }

      await this.recalcTotals(tx, productOrderId);
    });

    return { deleted: true };
  }

  async recalculateOrderTotals(productOrderId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.recalculateOrderTotalsInTransaction(tx, productOrderId);
    });
  }

  async recalculateOrderTotalsInTransaction(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
  ) {
    await this.recalcTotals(tx, productOrderId);
  }

  private async validateTaskStartPrerequisites(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
    operationStage: string | null | undefined,
    previousStatus: string | null | undefined,
    nextStatus: string | undefined,
  ) {
    const workStatuses = new Set(['IN_PROGRESS', 'PARTIALLY_COMPLETE', 'COMPLETE']);

    if (
      !nextStatus ||
      !workStatuses.has(nextStatus) ||
      (previousStatus ? workStatuses.has(previousStatus) : false) ||
      !operationStage
    ) {
      return;
    }

    // Look for a per-order override first, then fall back to global prerequisite
    const override = await tx.taskPrerequisiteOverride.findUnique({
      where: {
        productOrderId_stage: {
          productOrderId,
          stage: operationStage as any,
        },
      },
    }).catch(() => null);

    let requiredStage: string | null = null;
    let unlockThreshold = 'partial_any';

    if (override) {
      // null requiredStage = no prerequisite (PM cleared it for this order)
      requiredStage = override.requiredStage;
      unlockThreshold = override.unlockThreshold;
    } else {
      const globalPrereq = await tx.taskPrerequisite.findUnique({
        where: { stage: operationStage as any },
      }).catch(() => null);

      if (globalPrereq) {
        requiredStage = globalPrereq.requiredStage;
        unlockThreshold = globalPrereq.unlockThreshold;
      }
    }

    // No prerequisite configured — stage is open
    if (!requiredStage) {
      return;
    }

    // Check prerequisite stage status
    const prerequisiteOps = await tx.productOrderOperation.findMany({
      where: {
        productOrderId,
        operationStage: requiredStage as any,
      },
      select: { stageStatus: true, quantityFinished: true },
    });

    // SKIPPED counts as complete for gating purposes
    const completedStatuses = new Set(['COMPLETE', 'PARTIALLY_COMPLETE', 'SKIPPED']);
    const hasCompletedPrereq = prerequisiteOps.some(
      (op) => op.stageStatus && completedStatuses.has(op.stageStatus),
    );

    if (unlockThreshold === 'partial_any') {
      // Any quantity > 0 OR SKIPPED unlocks downstream
      const hasAnyQty = prerequisiteOps.some(
        (op) => (op.quantityFinished ?? 0) > 0,
      );
      const hasSkipped = prerequisiteOps.some(
        (op) => op.stageStatus === 'SKIPPED',
      );
      if (!hasAnyQty && !hasSkipped && !hasCompletedPrereq) {
        throw new BadRequestException(
          `Cannot start ${operationStage.replace(/_/g, ' ')} — prerequisite stage ${requiredStage.replace(/_/g, ' ')} has not produced any output yet`,
        );
      }
    } else if (unlockThreshold === 'full') {
      const allComplete = prerequisiteOps.length > 0 && prerequisiteOps.every(
        (op) => op.stageStatus === 'COMPLETE' || op.stageStatus === 'SKIPPED',
      );
      if (!allComplete) {
        throw new BadRequestException(
          `Cannot start ${operationStage.replace(/_/g, ' ')} — prerequisite stage ${requiredStage.replace(/_/g, ' ')} must be fully complete`,
        );
      }
    }
  }

  private async getReleasedTaskQuantity(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
  ) {
    const [cuttingOperations, paperSelections] = await Promise.all([
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'CUTTING' },
        select: { quantityFinished: true },
      }),
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'PAPER_SELECTION' },
        select: { quantityFinished: true },
      }),
    ]);

    const completedCuts = cuttingOperations.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );
    const completedPaperCutouts = paperSelections.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );

    return Math.max(completedCuts, completedPaperCutouts, 0);
  }

  private async validateCuttingOperation(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
    operation: {
      id?: string | null;
      operationStage?: string | null;
      paperSelectionOpId?: string | null;
      inventoryId?: string | null;
      paperSize?: string | null;
      cutSize?: string | null;
      cutQuantity?: number | null;
    },
  ) {
    if (operation.operationStage !== 'CUTTING') {
      return;
    }

    if (!operation.paperSize || !operation.cutSize) {
      return;
    }

    const cuttingMetrics = calculateCuttingMetrics(
      operation.paperSize,
      operation.cutSize,
    );
    const requestedCuts = operation.cutQuantity;

    if (
      requestedCuts === null ||
      requestedCuts === undefined ||
      !Number.isFinite(requestedCuts) ||
      requestedCuts < 1
    ) {
      throw new BadRequestException(
        'cutQuantity is required for cutting operations',
      );
    }

    const linkedPaperSelection =
      operation.paperSelectionOpId &&
      typeof operation.paperSelectionOpId === 'string'
        ? await tx.productOrderOperation.findFirst({
            where: {
              id: operation.paperSelectionOpId,
              productOrderId,
              operationStage: 'PAPER_SELECTION',
            },
            select: { inventoryId: true, quantityOfSheetsTaken: true },
          })
        : null;
    const requestedSheetUsage = calculateSheetFractionUsed(
      requestedCuts,
      cuttingMetrics.maxCutOutsPerSheet,
    );
    const linkedSheetQuantity = this.toNumber(
      linkedPaperSelection?.quantityOfSheetsTaken,
    );

    if (
      linkedSheetQuantity !== undefined &&
      linkedSheetQuantity > 0
    ) {
      if (requestedSheetUsage > linkedSheetQuantity + 0.0001) {
        throw new BadRequestException(
          `Requested cuts use ${requestedSheetUsage} source sheet(s), but this paper selection only has ${linkedSheetQuantity} sheet(s) taken`,
        );
      }
      return;
    }

    const paperInventoryId =
      operation.inventoryId ??
      linkedPaperSelection?.inventoryId ??
      (
        await tx.productOrderOperation.findFirst({
          where: {
            productOrderId,
            operationStage: 'PAPER_SELECTION',
            paperSize: operation.paperSize,
            inventoryId: { not: null },
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { inventoryId: true },
        })
      )?.inventoryId ??
      undefined;

    if (!paperInventoryId) {
      return;
    }

    const cuttingState = await this.getCuttingStateForPaper({
      productOrderId,
      inventoryId: paperInventoryId,
      paperSize: operation.paperSize,
      excludeOperationId: operation.id ?? undefined,
      excludePaperSelectionOpId: operation.paperSelectionOpId ?? undefined,
    });
    const productOrder =
      cuttingState.materialQuantity === null ||
      cuttingState.materialQuantity <= 0
        ? await tx.productOrder.findUnique({
            where: { id: productOrderId },
            select: { quantity: true },
          })
        : null;
    const plannedSheetsAvailable =
      cuttingState.materialQuantity !== null &&
      cuttingState.materialQuantity > 0
        ? cuttingState.materialQuantity
        : productOrder
          ? calculateSourceSheetsRequired(
              productOrder.quantity,
              cuttingMetrics.maxCutOutsPerSheet,
            )
          : null;

    if (
      plannedSheetsAvailable !== null &&
      cuttingState.usedSheets + requestedSheetUsage >
        plannedSheetsAvailable + 0.0001
    ) {
      throw new BadRequestException(
        `Requested cuts use ${requestedSheetUsage} source sheet(s), but only ${Number(Math.max(plannedSheetsAvailable - cuttingState.usedSheets, 0).toFixed(4))} source sheet(s) remain on this order`,
      );
    }
  }

  /**
   * If quantityFinished > 0 and status is not COMPLETE, auto-set to PARTIALLY_COMPLETE.
   * Called after resolveOperationFields and applyCompletionQuantityDefaults.
   */
  private applyAutoPartialStatus(resolvedFields: Record<string, unknown>): void {
    const qty = resolvedFields['quantityFinished'];
    const status = resolvedFields['stageStatus'] as string | undefined;
    const numQty =
      typeof qty === 'number'
        ? qty
        : qty !== null && qty !== undefined
          ? Number(qty)
          : null;
    if (numQty !== null && numQty > 0 && status !== 'COMPLETE' && status !== 'SKIPPED') {
      resolvedFields['stageStatus'] = 'PARTIALLY_COMPLETE';
    }
  }

  /**
   * Given the incoming fields (after resolveOperationFields) and the previous
   * stageStatus, inject startedAt / stageMovedAt / completedAt timestamps.
   *
   * Rules:
   *  - startedAt  → set once when status first becomes IN_PROGRESS (never overwritten)
   *  - stageMovedAt → updated every time stageStatus changes to any value
   *  - completedAt → set when status becomes COMPLETE; cleared if reverted away
   */
  private applyStatusTimestamps(
    resolvedFields: Record<string, unknown>,
    previousStatus: string | null | undefined,
    previousStartedAt: Date | null | undefined,
  ): void {
    const newStatus = resolvedFields['stageStatus'] as string | undefined;
    if (!newStatus) return; // stageStatus not being changed

    const now = new Date();
    const workStatuses = new Set(['IN_PROGRESS', 'PARTIALLY_COMPLETE', 'COMPLETE']);

    // Always stamp stageMovedAt whenever status changes
    if (newStatus !== previousStatus) {
      resolvedFields['stageMovedAt'] = now;
    }

    // startedAt: set once on first active work status, never overwrite
    if (workStatuses.has(newStatus) && !previousStartedAt) {
      resolvedFields['startedAt'] = now;
    }

    // completedAt: set on COMPLETE or SKIPPED, clear on revert
    if (newStatus === 'COMPLETE' || newStatus === 'SKIPPED') {
      resolvedFields['completedAt'] = now;
    } else if ((previousStatus === 'COMPLETE' || previousStatus === 'SKIPPED') && newStatus !== 'COMPLETE' && newStatus !== 'SKIPPED') {
      resolvedFields['completedAt'] = null;
    }
  }

  private async getAvailableQuantityFromCuts(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
  ) {
    const [cuttingOperations, paperSelections, productOrder] = await Promise.all([
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'CUTTING' },
        select: { cutQuantity: true, quantityFinished: true },
      }),
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'PAPER_SELECTION' },
        select: { quantityFinished: true },
      }),
      tx.productOrder.findUnique({
        where: { id: productOrderId },
        select: { quantity: true },
      }),
    ]);

    const totalCuts = cuttingOperations.reduce(
      (sum, operation) => sum + (operation.cutQuantity ?? 0),
      0,
    );
    const completedCuts = cuttingOperations.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );
    const completedPaperCutouts = paperSelections.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );

    return completedCuts > 0
      ? completedCuts
      : completedPaperCutouts > 0
        ? completedPaperCutouts
      : totalCuts > 0
        ? totalCuts
        : (productOrder?.quantity ?? 0);
  }

  private async applyCompletionQuantityDefaults(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
    operationStage: string | null | undefined,
    resolvedFields: Record<string, unknown>,
  ) {
    if (
      resolvedFields['stageStatus'] !== 'COMPLETE' ||
      operationStage === 'PAPER_SELECTION' ||
      operationStage === 'CUTTING'
    ) {
      return;
    }

    const availableQuantity = await this.getAvailableQuantityFromCuts(
      tx,
      productOrderId,
    );

    if (
      resolvedFields['quantityFinished'] === null ||
      resolvedFields['quantityFinished'] === undefined
    ) {
      resolvedFields['quantityFinished'] = availableQuantity;
    }

    if (
      operationStage === 'PACKAGING' &&
      (resolvedFields['quantityItemFinished'] === null ||
        resolvedFields['quantityItemFinished'] === undefined)
    ) {
      resolvedFields['quantityItemFinished'] = availableQuantity;
    }
  }

  private async syncCompletedOperationQuantities(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    productOrderId: string,
  ) {
    const [cuttingOperations, paperSelections] = await Promise.all([
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'CUTTING' },
        select: { cutQuantity: true, quantityFinished: true },
      }),
      tx.productOrderOperation.findMany({
        where: { productOrderId, operationStage: 'PAPER_SELECTION' },
        select: { quantityFinished: true },
      }),
    ]);
    const plannedCuts = cuttingOperations.reduce(
      (sum, operation) => sum + (operation.cutQuantity ?? 0),
      0,
    );
    const completedCuts = cuttingOperations.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );
    const completedPaperCutouts = paperSelections.reduce(
      (sum, operation) => sum + (operation.quantityFinished ?? 0),
      0,
    );
    const flowQuantity =
      completedCuts > 0
        ? completedCuts
        : completedPaperCutouts > 0
          ? completedPaperCutouts
          : plannedCuts;

    if (flowQuantity <= 0) {
      return;
    }

    await tx.productOrderOperation.updateMany({
      where: {
        productOrderId,
        stageStatus: 'COMPLETE',
        operationStage: { notIn: ['PAPER_SELECTION', 'CUTTING'] },
      },
      data: { quantityFinished: flowQuantity },
    });

    await tx.productOrderOperation.updateMany({
      where: {
        productOrderId,
        operationStage: 'PACKAGING',
        stageStatus: 'COMPLETE',
      },
      data: { quantityItemFinished: flowQuantity },
    });
  }

  private resolveOperationFields(fields: {
    paperSize?: string | null;
    cutSize?: string | null;
    costPerSheet?: { toString(): string } | string | null;
    diecutSize?: string | null;
    costPerCut?: { toString(): string } | string | null;
    cutQuantity?: number | null;
    costPerDiecut?: { toString(): string } | string | null;
    [key: string]: unknown;
  }) {
    const allowedKeys = new Set([
      'inventoryId',
      'paperSelectionOpId',
      'assignedStaffId',
      'paperSize',
      'sheetsPerPacket',
      'costPerPacket',
      'costPerSheet',
      'warehouseLocationId',
      'quantityOfSheetsTaken',
      'cutSize',
      'cutQuantity',
      'cutoutsPerSheet',
      'costPerCut',
      'costPerCutSheet',
      'ctpMachine',
      'ctpCostPerColor',
      'printMachine',
      'printCostPerColor',
      'laminationType',
      'laminationSize',
      'glossCost',
      'matteCost',
      'diecutSize',
      'costPerDiecut',
      'itemFinished',
      'finishingLocation',
      'twistedHandles',
      'bagBaseSize',
      'costPerFinish',
      'operationName',
      'quantityFinished',
      'quantityWasted',
      'quantityExcess',
      'estimatedTimeMin',
      'labourCost',
      'locationId',
      'expectedTimeline',
      'stageStatus',
      'vendor',
      'ctpPlates',
      'printImpressions',
      'printCostPerImpression',
      'laminationSheetsCount',
      'itemPackaged',
      'packagingLocation',
      'quantityItemFinished',
      'costPerPackaging',
      'targetOperationStage',
      'sourceCuttingOpId',
      'cutsConsumed',
      'startedAt',
      'stageMovedAt',
      'completedAt',
      // Artwork / Design
      'artworkDesignerId',
      'numberOfDesigns',
      'designNames',
      'designStatus',
      // CTP additional
      'ctpType',
      // Lamination additional
      'costPerLamination',
      // Finishing wastage breakdown
      'wastageFromPrinting',
      'wastageFromDiecutting',
      'wastageFromLaminating',
      'wastageFromHandling',
      'totalWastage',
    ]);

    const resolvedFields: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      if (allowedKeys.has(k)) {
        resolvedFields[k] = fields[k];
      }
    }

    if ('expectedTimeline' in resolvedFields) {
      resolvedFields.expectedTimeline = this.normalizeOptionalDateField(
        resolvedFields.expectedTimeline,
        'expectedTimeline',
      );
    }

    for (const timestampKey of ['startedAt', 'stageMovedAt', 'completedAt']) {
      if (timestampKey in resolvedFields) {
        resolvedFields[timestampKey] = this.normalizeOptionalDateField(
          resolvedFields[timestampKey],
          timestampKey,
        );
      }
    }

    const paperSize = fields.paperSize ?? undefined;
    const cutSize = fields.cutSize ?? undefined;

    if (cutSize && !isKnownCutSize(cutSize)) {
      throw new BadRequestException(`Unsupported cut size "${cutSize}"`);
    }

    if (paperSize && cutSize) {
      const rawCostPerSheet = fields.costPerSheet;
      const hasCostPerSheet =
        rawCostPerSheet !== null && rawCostPerSheet !== undefined;
      const parsedCostPerSheet = hasCostPerSheet
        ? Number(rawCostPerSheet.toString())
        : undefined;

      if (
        hasCostPerSheet &&
        (parsedCostPerSheet === undefined ||
          !Number.isFinite(parsedCostPerSheet) ||
          parsedCostPerSheet <= 0)
      ) {
        throw new BadRequestException('costPerSheet must be a positive number');
      }

      const cuttingMetrics = calculateCuttingMetrics(
        paperSize,
        cutSize,
        parsedCostPerSheet,
      );

      resolvedFields.paperSize = cuttingMetrics.sourceSheetSize;
      resolvedFields.cutSize = cuttingMetrics.cutSize;
      resolvedFields.costPerCut =
        cuttingMetrics.costPerCut !== null
          ? cuttingMetrics.costPerCut.toFixed(2)
          : null;

      if (!fields.diecutSize) {
        resolvedFields.diecutSize = cuttingMetrics.cutSize;
      }

      if (
        !('costPerDiecut' in resolvedFields) &&
        cuttingMetrics.costPerDiecut
      ) {
        resolvedFields.costPerDiecut = cuttingMetrics.costPerDiecut.toFixed(2);
      }
    }

    return resolvedFields;
  }

  private normalizeOptionalDateField(
    value: unknown,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException(`${fieldName} must be a valid date`);
      }
      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const isoDateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue);
    const normalizedValue = isoDateOnlyMatch
      ? `${trimmedValue}T00:00:00.000Z`
      : trimmedValue;
    const parsedDate = new Date(normalizedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsedDate;
  }

  private enrichOperation<
    T extends {
      paperSize?: string | null;
      cutSize?: string | null;
      cutQuantity?: number | null;
      costPerSheet?: { toString(): string } | string | null;
    },
  >(operation: T) {
    if (!operation.paperSize || !operation.cutSize) {
      return operation;
    }

    try {
      const parsedCostPerSheet =
        operation.costPerSheet !== null && operation.costPerSheet !== undefined
          ? Number(operation.costPerSheet.toString())
          : undefined;
      const cuttingMetrics = calculateCuttingMetrics(
        operation.paperSize,
        operation.cutSize,
        parsedCostPerSheet,
      );
      const requestedCuts =
        operation.cutQuantity !== null && operation.cutQuantity !== undefined
          ? operation.cutQuantity
          : null;

      return {
        ...operation,
        cuttingPreview: {
          ...cuttingMetrics,
          requestedCuts,
          sheetFractionUsed:
            requestedCuts !== null
              ? calculateSheetFractionUsed(
                  requestedCuts,
                  cuttingMetrics.maxCutOutsPerSheet,
                )
              : null,
          remainingCutCapacity:
            requestedCuts !== null
              ? calculateRemainingCutCapacity(
                  cuttingMetrics.maxCutOutsPerSheet,
                  requestedCuts,
                )
              : null,
          exceedsMaxCutOuts: false,
        },
      };
    } catch {
      return operation;
    }
  }

  private serializeFactoryWorkerActivity<
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

  /**
   * When a production order is completed, decrement inventory quantities for materials
   * and increment the produced product's opening stock.
   */
  async applyInventoryAdjustments(productOrderId: string) {
    // Delegate to ZohoSyncService which updates Zoho Books (authoritative inventory).
    try {
      return await this.zohoSyncService.applyInventoryAdjustments(
        productOrderId,
      );
    } catch (err: unknown) {
      // If Zoho sync fails, surface a controlled error for callers to handle/log.
      // Do not attempt local inventory mutation here to avoid diverging sources of truth.
      // Preserve the full original error message so the Zoho HTTP status + response body
      // are visible in the controller log and in the zohoSync response object.
      let reason = String(err);
      if (err && typeof err === 'object' && 'message' in err) {
        const e = err as { message?: unknown; response?: unknown };
        if (typeof e.message === 'string') reason = e.message;
        // NestJS HttpException stores the actual message in .response when constructed
        // with a plain string — fall back to that if .message is the generic HTTP label.
        if (
          (reason === 'Bad Request' || reason === 'Internal Server Error') &&
          e.response &&
          typeof e.response === 'string'
        ) {
          reason = e.response;
        }
      }
      throw new InternalServerErrorException(
        `Zoho assembly sync failed: ${reason}`,
      );
    }
  }

  async pushFinishingDelta(
    productOrderId: string,
    currentQuantityFinished: number,
  ) {
    return this.zohoSyncService.pushFinishingDelta(
      productOrderId,
      currentQuantityFinished,
    );
  }

  // ───────────────────────── Cost Summary ─────────────────────────

  async findOperationById(id: string) {
    return this.prisma.productOrderOperation.findUnique({
      where: { id },
      select: {
        id: true,
        productOrderId: true,
        operationStage: true,
        assignedStaffId: true,
        stageStatus: true,
      },
    });
  }

  async getCostSummary(productOrderId: string) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id: productOrderId },
      include: {
        materials: {
          select: { inventoryId: true, quantity: true, unitPrice: true, lineTotal: true, endTotal: true },
        },
        productOrderOperations: {
          select: {
            id: true,
            operationStage: true,
            stageStatus: true,
            quantityFinished: true,
            quantityWasted: true,
            costPerCut: true,
            cutQuantity: true,
            costPerSheet: true,
            quantityOfSheetsTaken: true,
            ctpCostPerColor: true,
            ctpPlates: true,
            printCostPerColor: true,
            printCostPerImpression: true,
            printImpressions: true,
            glossCost: true,
            matteCost: true,
            costPerLamination: true,
            laminationSheetsCount: true,
            costPerDiecut: true,
            diecutSize: true,
            costPerFinish: true,
            costPerPackaging: true,
            labourCost: true,
          },
        },
        factoryWorkerActivities: {
          select: { quantityAllocated: true, quantityFinished: true, quantityWasted: true, costPerFinish: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Production order not found');

    const materialTotal = (order.materials ?? []).reduce(
      (sum, m) => sum + (Number(m.lineTotal) || 0),
      0,
    );

    const stageCosts = buildOperationServiceSummary(
      order.productOrderOperations as any,
      order.quantity ?? 0,
    );

    const operationsTotal = stageCosts.total;

    const labourTotal = Number(order.labourCost) || 0;

    const grandTotal = Number(order.grandTotal) || (materialTotal + operationsTotal + labourTotal);
    const perUnit = order.quantity && order.quantity > 0 ? grandTotal / order.quantity : 0;

    return {
      orderId: order.id,
      productName: order.productName,
      sku: order.sku,
      quantity: order.quantity,
      materials: {
        items: order.materials,
        total: materialTotal,
      },
      operations: {
        stages: stageCosts.items,
        total: operationsTotal,
      },
      labour: labourTotal,
      grandTotal,
      perUnit: Math.round(perUnit * 100) / 100,
      materialVsOps: {
        materialPercent: grandTotal > 0 ? Math.round((materialTotal / grandTotal) * 10000) / 100 : 0,
        operationsPercent: grandTotal > 0 ? Math.round(((operationsTotal + labourTotal) / grandTotal) * 10000) / 100 : 0,
      },
    };
  }

  // ───────────────────── Task Prerequisites CRUD ──────────────────

  async getTaskPrerequisites() {
    return this.prisma.taskPrerequisite.findMany({
      orderBy: { stage: 'asc' },
    });
  }

  async upsertTaskPrerequisite(data: {
    stage: string;
    requiredStage: string;
    unlockThreshold?: string;
    thresholdPercent?: number;
  }) {
    return this.prisma.taskPrerequisite.upsert({
      where: { stage: data.stage as any },
      create: {
        stage: data.stage as any,
        requiredStage: data.requiredStage as any,
        unlockThreshold: data.unlockThreshold ?? 'partial_any',
        thresholdPercent: data.thresholdPercent,
      },
      update: {
        requiredStage: data.requiredStage as any,
        unlockThreshold: data.unlockThreshold ?? 'partial_any',
        thresholdPercent: data.thresholdPercent,
      },
    });
  }

  async deleteTaskPrerequisite(stage: string) {
    return this.prisma.taskPrerequisite.delete({
      where: { stage: stage as any },
    });
  }

  async getTaskPrerequisiteOverrides(productOrderId: string) {
    return this.prisma.taskPrerequisiteOverride.findMany({
      where: { productOrderId },
      orderBy: { stage: 'asc' },
    });
  }

  async upsertTaskPrerequisiteOverride(data: {
    productOrderId: string;
    stage: string;
    requiredStage: string | null;
    unlockThreshold?: string;
    thresholdPercent?: number;
  }) {
    return this.prisma.taskPrerequisiteOverride.upsert({
      where: {
        productOrderId_stage: {
          productOrderId: data.productOrderId,
          stage: data.stage as any,
        },
      },
      create: {
        productOrderId: data.productOrderId,
        stage: data.stage as any,
        requiredStage: data.requiredStage as any ?? undefined,
        unlockThreshold: data.unlockThreshold ?? 'partial_any',
        thresholdPercent: data.thresholdPercent,
      },
      update: {
        requiredStage: data.requiredStage as any ?? undefined,
        unlockThreshold: data.unlockThreshold ?? 'partial_any',
        thresholdPercent: data.thresholdPercent,
      },
    });
  }

  async deleteTaskPrerequisiteOverride(productOrderId: string, stage: string) {
    return this.prisma.taskPrerequisiteOverride.delete({
      where: {
        productOrderId_stage: {
          productOrderId,
          stage: stage as any,
        },
      },
    });
  }
}
