import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export interface ReportQuery {
  type: 'production' | 'stages' | 'wastage' | 'workers' | 'delays' | 'inventory' | 'financial';
  from?: string;
  to?: string;
  fields?: string[];  // field selection for report builder
  stage?: string;
  locationId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReportData(query: ReportQuery) {
    const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = query.to ? new Date(query.to) : new Date();

    switch (query.type) {
      case 'production':
        return this.productionReport(from, to, query.fields);
      case 'stages':
        return this.stagesReport(from, to, query.stage);
      case 'wastage':
        return this.wastageReport(from, to);
      case 'workers':
        return this.workersReport(from, to);
      case 'delays':
        return this.delaysReport(from, to);
      case 'inventory':
        return this.inventoryReport();
      case 'financial':
        return this.financialReport(from, to);
      default:
        return { rows: [], columns: [] };
    }
  }

  private async productionReport(from: Date, to: Date, fields?: string[]) {
    const orders = await this.prisma.productOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        productOrderOperations: {
          select: {
            operationStage: true,
            stageStatus: true,
            quantityFinished: true,
            quantityWasted: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allColumns = [
      'sku', 'productName', 'quantity', 'orderType', 'priority', 'status',
      'grandTotal', 'subtotal', 'labourCost', 'completedStages',
      'totalFinished', 'totalWasted', 'createdAt',
    ];
    const columns = fields?.length ? allColumns.filter(c => fields.includes(c)) : allColumns;

    const rows = orders.map(o => {
      const completedStages = o.productOrderOperations.filter(
        op => op.stageStatus === 'COMPLETE' || op.stageStatus === 'SKIPPED'
      ).length;
      const totalFinished = o.productOrderOperations.reduce(
        (s, op) => s + (op.quantityFinished ?? 0), 0
      );
      const totalWasted = o.productOrderOperations.reduce(
        (s, op) => s + (op.quantityWasted ?? 0), 0
      );

      const row: Record<string, unknown> = {
        sku: o.sku,
        productName: o.productName,
        quantity: o.quantity,
        orderType: o.orderType,
        priority: o.priority,
        status: o.status,
        grandTotal: o.grandTotal,
        subtotal: o.subtotal,
        labourCost: o.labourCost,
        completedStages,
        totalFinished,
        totalWasted,
        createdAt: o.createdAt,
      };

      if (fields?.length) {
        const filtered: Record<string, unknown> = {};
        for (const f of fields) {
          if (f in row) filtered[f] = row[f];
        }
        return filtered;
      }
      return row;
    });

    return { columns, rows, total: rows.length };
  }

  private async stagesReport(from: Date, to: Date, stage?: string) {
    const where: any = { createdAt: { gte: from, lte: to } };
    if (stage) where.operationStage = stage;

    const ops = await this.prisma.productOrderOperation.findMany({
      where,
      select: {
        operationStage: true,
        stageStatus: true,
        quantityFinished: true,
        quantityWasted: true,
        startedAt: true,
        completedAt: true,
        assignedStaffId: true,
        productOrder: { select: { sku: true, productName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = ['sku', 'productName', 'operationStage', 'stageStatus', 'quantityFinished', 'quantityWasted', 'startedAt', 'completedAt'];
    const rows = ops.map(op => ({
      sku: op.productOrder?.sku,
      productName: op.productOrder?.productName,
      operationStage: op.operationStage,
      stageStatus: op.stageStatus,
      quantityFinished: op.quantityFinished,
      quantityWasted: op.quantityWasted,
      startedAt: op.startedAt,
      completedAt: op.completedAt,
    }));

    return { columns, rows, total: rows.length };
  }

  private async wastageReport(from: Date, to: Date) {
    const ops = await this.prisma.productOrderOperation.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        quantityWasted: { gt: 0 },
      },
      select: {
        operationStage: true,
        quantityFinished: true,
        quantityWasted: true,
        productOrder: { select: { sku: true, productName: true, quantity: true } },
      },
      orderBy: { quantityWasted: 'desc' },
    });

    const columns = ['sku', 'productName', 'operationStage', 'orderQty', 'quantityFinished', 'quantityWasted', 'wastagePercent'];
    const rows = ops.map(op => {
      const orderQty = op.productOrder?.quantity ?? 0;
      return {
        sku: op.productOrder?.sku,
        productName: op.productOrder?.productName,
        operationStage: op.operationStage,
        orderQty,
        quantityFinished: op.quantityFinished,
        quantityWasted: op.quantityWasted,
        wastagePercent: orderQty > 0
          ? Math.round(((op.quantityWasted ?? 0) / orderQty) * 10000) / 100
          : 0,
      };
    });

    return { columns, rows, total: rows.length };
  }

  private async workersReport(from: Date, to: Date) {
    const activities = await this.prisma.factoryWorkerActivity.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        workerNames: true,
        quantityAllocated: true,
        quantityFinished: true,
        quantityWasted: true,
        costPerFinish: true,
        typeOfFinishing: true,
        productOrder: { select: { sku: true, productName: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = ['sku', 'productName', 'workerNames', 'location', 'typeOfFinishing', 'quantityAllocated', 'quantityFinished', 'quantityWasted', 'costPerFinish'];
    const rows = activities.map(a => ({
      sku: a.productOrder?.sku,
      productName: a.productOrder?.productName,
      workerNames: a.workerNames,
      location: a.location?.name,
      typeOfFinishing: a.typeOfFinishing,
      quantityAllocated: a.quantityAllocated,
      quantityFinished: a.quantityFinished,
      quantityWasted: a.quantityWasted,
      costPerFinish: a.costPerFinish,
    }));

    return { columns, rows, total: rows.length };
  }

  private async delaysReport(from: Date, to: Date) {
    const ops = await this.prisma.productOrderOperation.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        expectedTimeline: { not: null },
      },
      select: {
        operationStage: true,
        stageStatus: true,
        expectedTimeline: true,
        completedAt: true,
        startedAt: true,
        assignedStaffId: true,
        productOrder: { select: { sku: true, productName: true } },
      },
      orderBy: { expectedTimeline: 'asc' },
    });

    const columns = ['sku', 'productName', 'operationStage', 'stageStatus', 'expectedTimeline', 'completedAt', 'delayDays'];
    const now = new Date();
    const rows = ops
      .map(op => {
        const deadline = op.expectedTimeline ? new Date(op.expectedTimeline) : null;
        const completed = op.completedAt ? new Date(op.completedAt) : null;
        const referenceDate = completed ?? now;
        const delayDays = deadline
          ? Math.round((referenceDate.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          sku: op.productOrder?.sku,
          productName: op.productOrder?.productName,
          operationStage: op.operationStage,
          stageStatus: op.stageStatus,
          expectedTimeline: op.expectedTimeline,
          completedAt: op.completedAt,
          delayDays,
        };
      })
      .filter(r => r.delayDays !== null && r.delayDays > 0);

    return { columns, rows, total: rows.length };
  }

  private async inventoryReport() {
    const items = await this.prisma.inventory.findMany({
      select: {
        itemName: true,
        sku: true,
        quantityInStock: true,
        itemType: true,
        averagePrice: true,
        price: true,
      },
      orderBy: { itemName: 'asc' },
    });

    const columns = ['itemName', 'sku', 'quantityInStock', 'itemType', 'averagePrice', 'price'];
    const rows = items.map(i => ({
      itemName: i.itemName,
      sku: i.sku,
      quantityInStock: i.quantityInStock,
      itemType: i.itemType,
      averagePrice: i.averagePrice,
      price: i.price,
    }));

    return { columns, rows, total: rows.length };
  }

  private async financialReport(from: Date, to: Date) {
    const orders = await this.prisma.productOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        sku: true,
        productName: true,
        quantity: true,
        orderType: true,
        subtotal: true,
        labourCost: true,
        grandTotal: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = ['sku', 'productName', 'quantity', 'orderType', 'subtotal', 'labourCost', 'grandTotal', 'perUnit', 'status', 'createdAt'];
    const rows = orders.map(o => ({
      sku: o.sku,
      productName: o.productName,
      quantity: o.quantity,
      orderType: o.orderType,
      subtotal: o.subtotal,
      labourCost: o.labourCost,
      grandTotal: o.grandTotal,
      perUnit: o.quantity && o.quantity > 0 ? Math.round((Number(o.grandTotal) || 0) / o.quantity * 100) / 100 : 0,
      status: o.status,
      createdAt: o.createdAt,
    }));

    return { columns, rows, total: rows.length };
  }
}
