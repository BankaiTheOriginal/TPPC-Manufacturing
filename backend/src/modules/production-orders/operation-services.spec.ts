import {
  buildFactoryLabourServiceSummary,
  buildOperationServiceSummary,
} from './operation-services';

describe('buildFactoryLabourServiceSummary', () => {
  it('builds a factory labour service line from finished quantity and unit cost', () => {
    const summary = buildFactoryLabourServiceSummary([
      {
        id: 'activity-1',
        workDate: '2026-05-26T00:00:00.000Z',
        typeOfFinishing: 'Handle Attachment',
        quantityAllocated: 120,
        quantityFinished: 100,
        costPerFinish: '12.50',
      },
    ]);

    expect(summary.total).toBe(1250);
    expect(summary.items).toEqual([
      expect.objectContaining({
        operationId: 'activity-1',
        operationStage: 'FACTORY_LABOUR',
        stageLabel: 'Factory Labour',
        serviceSku: 'TPPC-SVC-FACTORY-LABOUR',
        serviceName: 'Factory Labour Service',
        operationName: 'Handle Attachment',
        stageStatus: 'COMPLETE',
        quantity: 100,
        unitCost: 12.5,
        totalCost: 1250,
        quantitySource: 'quantityFinished',
        sourceCostField: 'costPerFinish',
      }),
    ]);
  });
});

describe('buildOperationServiceSummary', () => {
  it('rolls bag base cost and twisted handles into the FINISHING total', () => {
    const summary = buildOperationServiceSummary(
      [
        {
          id: 'op-fin-1',
          operationStage: 'FINISHING',
          quantityFinished: 100,
          costPerFinish: '18',
          bagBaseSize: 'LARGE',
          twistedHandles: 200,
        },
      ],
      100,
    );

    // 100 * (18 + 10) + 200 * 65 = 2800 + 13000 = 15800
    expect(summary.total).toBe(15800);
    expect(summary.items[0]).toEqual(
      expect.objectContaining({
        operationStage: 'FINISHING',
        quantity: 100,
        unitCost: 28,
        totalCost: 15800,
      }),
    );
  });

  it('uses cutQuantity (not printImpressions) for DIECUTTING cost', () => {
    const summary = buildOperationServiceSummary(
      [
        {
          id: 'op-dc-1',
          operationStage: 'DIECUTTING',
          cutQuantity: 120,
          printImpressions: 999,
          costPerDiecut: '4',
        },
      ],
      0,
    );

    expect(summary.items[0]).toEqual(
      expect.objectContaining({
        operationStage: 'DIECUTTING',
        quantity: 120,
        unitCost: 4,
        totalCost: 480,
        quantitySource: 'cutQuantity',
      }),
    );
  });
});