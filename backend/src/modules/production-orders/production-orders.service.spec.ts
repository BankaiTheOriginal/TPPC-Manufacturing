import { describe, expect, it, jest } from '@jest/globals';

jest.mock('src/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('src/modules/zoho/zoho-sync.service', () => ({
  ZohoSyncService: class ZohoSyncService {},
}));

jest.mock('src/modules/notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { ProductionOrdersService } from './production-orders.service';

describe('ProductionOrdersService', () => {
  it('blocks starting downstream tasks before cutting is complete', async () => {
    const tx = {
      productOrderOperation: {
        findUnique: jest.fn(async () => ({
          id: 'op-1',
          productOrderId: 'po-1',
          operationStage: 'PRINTING',
          stageStatus: 'PENDING',
          startedAt: null,
        })),
        findMany: jest.fn(
          async () => [] as Array<{ quantityFinished: number | null }>,
        ),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never;
    const zohoSyncService = {} as never;
    const notificationsService = {} as never;
    const service = new ProductionOrdersService(
      prisma,
      zohoSyncService,
      notificationsService,
    );

    jest.spyOn(service, 'listProductionOrder').mockResolvedValue({} as never);

    await expect(
      service.upsertOperation('po-1', {
        id: 'op-1',
        operationStage: 'PRINTING',
        stageStatus: 'IN_PROGRESS',
      } as never),
    ).rejects.toThrow(
      'Unable to start task because no cut quantity is available yet',
    );

    expect(tx.productOrderOperation.findMany).toHaveBeenCalledTimes(2);
    expect(tx.productOrderOperation.update).not.toHaveBeenCalled();
  });

  it.each(['ARTWORK_DESIGN', 'CTP_MAKING'])(
    'allows starting %s before cutting is complete',
    async (operationStage) => {
      const tx = {
        productOrderOperation: {
          findUnique: jest.fn(async () => ({
            id: 'op-1',
            productOrderId: 'po-1',
            operationStage,
            stageStatus: 'PENDING',
            startedAt: null,
          })),
          findFirst: jest.fn(),
          update: jest.fn(async () => ({
            id: 'op-1',
            operationStage,
            stageStatus: 'IN_PROGRESS',
          })),
        },
      };
      const prisma = {
        $transaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) =>
          callback(tx),
        ),
      } as never;
      const zohoSyncService = {} as never;
      const notificationsService = {} as never;
      const service = new ProductionOrdersService(
        prisma,
        zohoSyncService,
        notificationsService,
      );

      jest
        .spyOn(service, 'listProductionOrder')
        .mockResolvedValue({} as never);
      jest
        .spyOn(
          service as unknown as { recalcTotals: () => Promise<void> },
          'recalcTotals',
        )
        .mockResolvedValue();

      await expect(
        service.upsertOperation('po-1', {
          id: 'op-1',
          operationStage,
          stageStatus: 'IN_PROGRESS',
        } as never),
      ).resolves.toMatchObject({
        id: 'op-1',
        operationStage,
        stageStatus: 'IN_PROGRESS',
      });

      expect(tx.productOrderOperation.findFirst).not.toHaveBeenCalled();
      expect(tx.productOrderOperation.update).toHaveBeenCalled();
    },
  );

  it('updates source paper material quantityUsed from fractional cutting usage', async () => {
    const prisma = {} as never;
    const zohoSyncService = {} as never;
    const notificationsService = {} as never;
    const service = new ProductionOrdersService(prisma, zohoSyncService, notificationsService);

    const update = jest.fn(async (..._args: unknown[]) => ({}));
    const create = jest.fn(async (..._args: unknown[]) => ({}));

    const tx = {
      productOrder: {
        findUnique: jest.fn(async () => ({ quantity: 100 })),
      },
      productOrderOperation: {
        findMany: jest.fn(
          async ({ where }: { where: { operationStage: string } }) => {
            if (where.operationStage === 'PAPER_SELECTION') {
              return [
                {
                  inventoryId: 'paper-1',
                  paperSize: '24*36',
                  cutSize: null,
                  cutQuantity: null,
                  inventory: {
                    id: 'paper-1',
                    itemName: 'Test Paper 24x36',
                    averagePrice: 120,
                    itemType: 'Paper',
                  },
                },
              ];
            }

            return [
              {
                inventoryId: 'paper-1',
                paperSize: '24*36',
                cutSize: '12*12',
                cutQuantity: 1,
              },
              {
                inventoryId: 'paper-1',
                paperSize: '24*36',
                cutSize: '12*12',
                cutQuantity: 2,
              },
            ];
          },
        ),
      },
      productOrderMaterial: {
        findFirst: jest.fn(async () => ({
          id: 'material-1',
          quantity: '20.0000',
          quantityUsed: '0.0000',
        })),
        update,
        create,
        delete: jest.fn(),
      },
    };

    await service['syncPaperSelectionMaterials'](tx as never, 'po-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'material-1' },
      data: expect.objectContaining({
        quantityUsed: '0.5000',
        endTotal: '2340.00',
      }),
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('normalizes date-only expectedTimeline values for Prisma DateTime fields', () => {
    const prisma = {} as never;
    const zohoSyncService = {} as never;
    const notificationsService = {} as never;
    const service = new ProductionOrdersService(
      prisma,
      zohoSyncService,
      notificationsService,
    );

    const resolved = service['resolveOperationFields']({
      expectedTimeline: '2026-06-11',
      quantityOfSheetsTaken: 2,
    });

    expect(resolved).toMatchObject({
      quantityOfSheetsTaken: 2,
    });
    expect(resolved.expectedTimeline).toBeInstanceOf(Date);
    expect((resolved.expectedTimeline as Date).toISOString()).toBe(
      '2026-06-11T00:00:00.000Z',
    );
  });

  it('rejects invalid expectedTimeline values before hitting Prisma', () => {
    const prisma = {} as never;
    const zohoSyncService = {} as never;
    const notificationsService = {} as never;
    const service = new ProductionOrdersService(
      prisma,
      zohoSyncService,
      notificationsService,
    );

    expect(() =>
      service['resolveOperationFields']({
        expectedTimeline: 'not-a-date',
      }),
    ).toThrow('expectedTimeline must be a valid date');
  });
});
