import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { UpsertOperationDto } from './dto/upsert-operation.dto';
import { AddMaterialDto } from './dto/add-material.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { AuditService } from 'src/modules/audit-logs/audit.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthUser } from 'src/common/decorators/current-user.decorator';
import type { Request } from 'express';
import {
  Cache,
  CACHE_MANAGER,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/cache-manager';
import { ZohoSyncService } from 'src/modules/zoho/zoho-sync.service';

import { Roles } from 'src/common/decorators/roles.decorator';

const PO_WRITE_ROLES: any[] = ['ADMINISTRATOR', 'GENERAL_MANAGER', 'PRODUCTION_MANAGER', 'HEAD_OF_OPERATIONS', 'SUPERVISOR'];

@Controller('production-orders')
export class ProductionOrdersController {
  private readonly logger = new Logger(ProductionOrdersController.name);

  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly zohoSyncService: ZohoSyncService,
  ) {}
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get()
  async listProductionOrders(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('includeOperations') includeOperations?: string,
    @Query('search') search?: string,
  ) {
    return this.productionOrdersService.listProductionOrders(
      Number(page),
      Number(limit),
      includeOperations === 'true',
      search,
    );
  }

  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get('rules')
  async getProductionRules() {
    return this.productionOrdersService.getProductionRules();
  }

  @Get('tasks')
  async listAllTasks(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('stage') stage?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('productOrderId') productOrderId?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('priority') priority?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @Query('assignedStaffId') assignedStaffId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    // Non-management roles only see their own assigned tasks
    const MANAGEMENT_ROLES = [
      'ADMINISTRATOR',
      'GENERAL_MANAGER',
      'PRODUCTION_MANAGER',
      'HEAD_OF_OPERATIONS',
      'SUPERVISOR',
    ];
    const effectiveAssignedStaffId =
      user && !MANAGEMENT_ROLES.includes(user.role)
        ? user.id
        : assignedStaffId;

    return this.productionOrdersService.listAllTasks(
      Number(page),
      Number(limit),
      stage,
      status,
      search,
      productOrderId,
      salesOrderId,
      priority,
      sortBy,
      sortDirection,
      effectiveAssignedStaffId,
    );
  }

  @Get('task-filter-options')
  async listTaskFilterOptions() {
    return this.productionOrdersService.listTaskFilterOptions();
  }

  // ───────────────────── Task Prerequisites ───────────────────

  @Get('task-prerequisites')
  async getTaskPrerequisites() {
    return this.productionOrdersService.getTaskPrerequisites();
  }

  @Roles('ADMINISTRATOR' as any)
  @Post('task-prerequisites')
  async upsertTaskPrerequisite(
    @Body() body: { stage: string; requiredStage: string; unlockThreshold?: string; thresholdPercent?: number },
  ) {
    return this.productionOrdersService.upsertTaskPrerequisite(body);
  }

  @Roles('ADMINISTRATOR' as any)
  @Delete('task-prerequisites/:stage')
  async deleteTaskPrerequisite(@Param('stage') stage: string) {
    return this.productionOrdersService.deleteTaskPrerequisite(stage);
  }

  // ───────────────── Worker Task Update (restricted fields) ─────

  @Patch('tasks/:taskId')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() body: {
      quantityFinished?: number;
      quantityWasted?: number;
      stageStatus?: string;
      expectedTimeline?: string;
      notes?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const MANAGEMENT_ROLES = [
      'ADMINISTRATOR',
      'GENERAL_MANAGER',
      'PRODUCTION_MANAGER',
      'HEAD_OF_OPERATIONS',
      'SUPERVISOR',
    ];

    const task = await this.productionOrdersService.findOperationById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    if (!MANAGEMENT_ROLES.includes(user.role)) {
      if (task.assignedStaffId !== user.id) {
        throw new BadRequestException('You can only update tasks assigned to you');
      }
    }

    const updateData: UpsertOperationDto = {
      id: taskId,
      operationStage: task.operationStage as any,
    };

    if (body.quantityFinished !== undefined) updateData.quantityFinished = body.quantityFinished;
    if (body.quantityWasted !== undefined) updateData.quantityWasted = body.quantityWasted;
    if (body.stageStatus !== undefined) (updateData as any).stageStatus = body.stageStatus;
    if (body.expectedTimeline !== undefined) (updateData as any).expectedTimeline = body.expectedTimeline;

    const result = await this.productionOrdersService.upsertOperation(
      task.productOrderId,
      updateData,
    );
    await this.cacheManager.del(`/production-orders/${task.productOrderId}`);
    return result;
  }

  @Get('cutting-preview')
  async previewCutting(
    @Query('paperSize') paperSize?: string,
    @Query('cutSize') cutSize?: string,
    @Query('costPerSheet') costPerSheet?: string,
    @Query('requestedCuts') requestedCuts?: string,
    @Query('productOrderId') productOrderId?: string,
    @Query('inventoryId') inventoryId?: string,
    @Query('operationId') operationId?: string,
    @Query('quantityOfSheetsTaken') quantityOfSheetsTaken?: string,
  ) {
    return await this.productionOrdersService.previewCutting(
      paperSize,
      cutSize,
      costPerSheet,
      requestedCuts,
      productOrderId,
      inventoryId,
      operationId,
      quantityOfSheetsTaken,
    );
  }

  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @Get(':id')
  async listProductionOrder(@Param('id') id: string) {
    return this.productionOrdersService.listProductionOrder(id);
  }

  @Roles(...PO_WRITE_ROLES)
  @Post()
  async createProductionOrder(@Body() data: CreateProductionOrderDto) {
    const result =
      await this.productionOrdersService.createProductionOrder(data);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Patch(':id')
  async updateProductionOrder(
    @Param('id') id: string,
    @Body() data: UpdateProductionOrderDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    // load existing status fields only — avoid expensive full-include query
    const existing = await this.productionOrdersService.getProductionOrderStatus(id);
    this.logger.log(
      `Updating production order ${id} from status ${existing?.status ?? 'UNKNOWN'} with payload ${JSON.stringify(data)}`,
    );
    const result = await this.productionOrdersService.updateProductionOrder(
      id,
      data,
    );
    let zohoSync:
      | {
          attempted: boolean;
          success: boolean;
          details?: unknown;
          error?: string;
        }
      | undefined;

    // If status changed to COMPLETE, log an audit entry
    if (
      existing?.status !== result?.status &&
      (result?.status === 'COMPLETE' ||
        result?.status === 'PARTIALLY_COMPLETE') &&
      user?.id
    ) {
      await this.auditService.logDataChange({
        action: 'UPDATE',
        userId: user.id,
        entityType: 'ProductOrder',
        entityId: result.id,
        before: { status: existing?.status ?? null },
        after: { status: result?.status },
        ctx: {
          requestId:
            (req.headers['x-request-id'] as string | undefined) ?? result.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
          httpMethod: req.method,
          route: req.originalUrl ?? req.url,
        },
      });

      // Apply inventory adjustments (consume materials, increase finished product stock)
      try {
        // Delegate inventory adjustments to the service (which will update Zoho)
        this.logger.log(
          `Production order ${result.id} marked COMPLETE. Starting Zoho composite + assembly sync.`,
        );
        const syncResult =
          await this.productionOrdersService.applyInventoryAdjustments(
            result.id,
          );
        zohoSync = {
          attempted: true,
          success: true,
          details: syncResult,
        };
        this.logger.log(
          `Zoho sync completed for production order ${result.id}: ${JSON.stringify(syncResult)}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        zohoSync = {
          attempted: true,
          success: false,
          error: message,
        };
        // Do not fail the request if Zoho sync fails; log for investigation
        this.logger.error(
          `[ZOHO ASSEMBLY] Sync failed for production order ${result.id}: ${message}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    await this.cacheManager.del(`/production-orders/${id}`);
    await this.cacheManager.clear();
    return { ...result, zohoSync: zohoSync ?? null };
  }

  @Roles('ADMINISTRATOR')
  @Delete(':id')
  async deleteProductionOrder(@Param('id') id: string) {
    const result = await this.productionOrdersService.deleteProductionOrder(id);
    await this.cacheManager.del(`/production-orders/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles('ADMINISTRATOR')
  @Post('bulk-delete')
  async bulkDeleteProductionOrders(
    @Body() body: BulkDeleteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ids = body.ids;
    const result =
      await this.productionOrdersService.bulkDeleteProductionOrders(ids);

    // Log audit entries for each deleted order when user is present
    if (user?.id && Array.isArray(ids)) {
      for (const id of ids) {
        try {
          await this.auditService.logDataChange({
            action: 'DELETE',
            userId: user.id,
            entityType: 'ProductOrder',
            entityId: id,
            ctx: {
              requestId:
                (req.headers['x-request-id'] as string | undefined) ?? id,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'] as string | undefined,
              httpMethod: req.method,
              route: req.originalUrl ?? req.url,
            },
          });
        } catch {
          // ignore audit failures
        }
      }
    }

    await this.cacheManager.clear();
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Post(':id/operations')
  async upsertOperation(
    @Param('id') id: string,
    @Body() data: UpsertOperationDto,
  ) {
    this.logger.log(
      `Task operation update payload for production order ${id}: ${JSON.stringify(data)}`,
    );
    const result = await this.productionOrdersService.upsertOperation(id, data);
    this.logger.log(
      `Task operation update result for production order ${id}: ${JSON.stringify({ id: result.id, operationStage: result.operationStage, stageStatus: result.stageStatus, quantityFinished: result.quantityFinished, quantityWasted: result.quantityWasted, updatedAt: result.updatedAt })}`,
    );
    await this.cacheManager.del(`/production-orders/${id}`);

    // Fire-and-forget: Zoho finishing delta push (non-blocking)
    if (
      data.operationStage === 'FINISHING' &&
      result.quantityFinished != null &&
      result.quantityFinished > 0
    ) {
      const qty = result.quantityFinished;
      void this.productionOrdersService
        .pushFinishingDelta(id, qty)
        .then((r) =>
          this.logger.log(`Zoho finishing delta push for ${id}: ${JSON.stringify(r)}`),
        )
        .catch((err: unknown) =>
          this.logger.error(
            `Zoho finishing delta push failed for ${id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    // Fire-and-forget: ensure Zoho service item exists for this stage (non-blocking)
    if (data.operationStage) {
      const stage = data.operationStage;
      void this.zohoSyncService
        .ensureOperationServiceItem(stage)
        .then((r) =>
          this.logger.log(`Zoho operation service sync for ${id}: ${JSON.stringify(r)}`),
        )
        .catch((err: unknown) =>
          this.logger.error(
            `Zoho operation service sync failed for ${id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Post(':id/repeat')
  async repeatProductionOrder(@Param('id') id: string) {
    const result = await this.productionOrdersService.repeatProductionOrder(id);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Post(':id/materials')
  async addMaterial(@Param('id') id: string, @Body() data: AddMaterialDto) {
    const result = await this.productionOrdersService.addMaterial(id, data);
    await this.cacheManager.del(`/production-orders/${id}`);
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Delete(':id/materials/:materialId')
  async removeMaterial(
    @Param('id') id: string,
    @Param('materialId') materialId: string,
  ) {
    const result = await this.productionOrdersService.removeMaterial(
      id,
      materialId,
    );
    await this.cacheManager.del(`/production-orders/${id}`);
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Delete(':id/operations/:operationId')
  async deleteOperation(
    @Param('id') id: string,
    @Param('operationId') operationId: string,
  ) {
    const result = await this.productionOrdersService.deleteOperation(
      id,
      operationId,
    );
    await this.cacheManager.del(`/production-orders/${id}`);
    await this.cacheManager.clear();
    return result;
  }

  @Roles(...PO_WRITE_ROLES)
  @Patch(':id/materials/:materialId/usage')
  async updateMaterialUsage(
    @Param('id') id: string,
    @Param('materialId') materialId: string,
    @Body('quantityUsed') quantityUsed: string,
  ) {
    const result = await this.productionOrdersService.updateMaterialUsage(
      id,
      materialId,
      quantityUsed,
    );
    await this.cacheManager.del(`/production-orders/${id}`);
    return result;
  }

  // ───────────────────── Cost Summary ─────────────────────────

  @Get(':id/cost-summary')
  async getCostSummary(@Param('id') id: string) {
    return this.productionOrdersService.getCostSummary(id);
  }

  @Get(':id/prerequisite-overrides')
  async getPrerequisiteOverrides(@Param('id') id: string) {
    return this.productionOrdersService.getTaskPrerequisiteOverrides(id);
  }

  @Roles('ADMINISTRATOR' as any, 'PRODUCTION_MANAGER' as any)
  @Post(':id/prerequisite-overrides')
  async upsertPrerequisiteOverride(
    @Param('id') id: string,
    @Body() body: { stage: string; requiredStage: string | null; unlockThreshold?: string; thresholdPercent?: number },
  ) {
    return this.productionOrdersService.upsertTaskPrerequisiteOverride({
      ...body,
      productOrderId: id,
    });
  }

  @Roles('ADMINISTRATOR' as any, 'PRODUCTION_MANAGER' as any)
  @Delete(':id/prerequisite-overrides/:stage')
  async deletePrerequisiteOverride(
    @Param('id') id: string,
    @Param('stage') stage: string,
  ) {
    return this.productionOrdersService.deleteTaskPrerequisiteOverride(id, stage);
  }
}
