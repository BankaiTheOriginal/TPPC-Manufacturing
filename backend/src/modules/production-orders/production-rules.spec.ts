import {
  buildPaperRuleFromInventoryItem,
  calculateRemainingCutCapacity,
  calculateCuttingMetrics,
  calculateSheetFractionUsed,
  calculateSourceSheetsRequired,
  getProductionRules,
  normalizeSize,
  toStorageSize,
} from './production-rules';

describe('production-rules', () => {
  it('normalizes sizes from workbook and legacy storage formats', () => {
    expect(normalizeSize('36*48')).toBe('36x48');
    expect(normalizeSize('36\u00d748')).toBe('36x48');
    expect(toStorageSize('36x48')).toBe('36*48');
  });

  it('calculates cut outs, bag sheets, and tiered cutting costs', () => {
    expect(calculateCuttingMetrics('36*48', '16*18')).toMatchObject({
      sourceSheetSize: '36*48',
      cutSize: '16*18',
      rawCutOuts: 6,
      maxCutOutsPerSheet: 6,
      cutOuts: 6,
      bagSheets: 3,
      costPerCut: 7,
      costPerDiecut: 15,
    });

    expect(calculateCuttingMetrics('36*48', '13.5*15.5')).toMatchObject({
      cutOuts: 8,
      bagSheets: 4,
      costPerCut: 5,
      costPerDiecut: 6,
    });
  });

  it('calculates cost of paper used when costPerSheet is provided', () => {
    expect(calculateCuttingMetrics('36*48', '16*18', 470)).toMatchObject({
      costOfPaperUsed: 78.33,
    });
  });

  it('calculates fractional sheet usage and remaining capacity from requested cuts', () => {
    expect(calculateSheetFractionUsed(1, 4)).toBe(0.25);
    expect(calculateSheetFractionUsed(3, 4)).toBe(0.75);
    expect(calculateRemainingCutCapacity(4, 1)).toBe(3);
    expect(calculateRemainingCutCapacity(4, 5)).toBe(0);
  });

  it('calculates how many source sheets are required for the order quantity', () => {
    expect(calculateSourceSheetsRequired(100, 4)).toBe(25);
    expect(calculateSourceSheetsRequired(101, 4)).toBe(26);
    expect(calculateSourceSheetsRequired(0, 4)).toBe(0);
  });

  it('returns workbook-backed production rules for the client', () => {
    const rules = getProductionRules();

    expect(rules.sourceSheetSizes).toEqual(
      expect.arrayContaining([{ value: '36*48', label: '36x48' }]),
    );
    expect(rules.cutCostRules).toEqual(
      expect.arrayContaining([{ range: '1-6', cost: 7 }]),
    );
    expect(rules.formulas.sourceSheetsRequired).toBe(
      'Source sheets required = ceiling(order quantity / no of cut outs)',
    );
    expect(rules.paperTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paperType: 'FBB 250gsm',
          sourceSheetSize: '36*48',
          costPerSheet: 470,
        }),
      ]),
    );
    expect(rules.paperItems).toEqual(rules.paperTypes);

    expect(rules.bagBase).toEqual(
      expect.arrayContaining([
        { size: 'SMALL', label: 'Small bag', costPerBag: 5 },
        { size: 'LARGE', label: 'Large bag', costPerBag: 10 },
        { size: 'XLARGE', label: 'XLarge bag', costPerBag: 15 },
      ]),
    );
    expect(rules.twistedHandles.unitCost).toBe(65);
  });

  it('builds paper rules from inventory items', () => {
    const paperRule = buildPaperRuleFromInventoryItem({
      id: 'inv_1',
      sku: 'INV-001',
      itemName: 'White Art Card 36x48 (300gsm)',
      category: 'Art Card',
      quantityInStock: 200,
      averagePrice: 550,
      price: 55000,
    });

    expect(paperRule).toMatchObject({
      itemId: 'inv_1',
      sku: 'INV-001',
      paperType: 'White Art Card 36x48 (300gsm)',
      sourceSheetSize: '36x48',
      costPerPacket: 55000,
      sheetsPerPacket: 100,
      costPerSheet: 550,
    });
  });

  it('rejects cut sizes that do not fit the chosen source sheet', () => {
    expect(() => calculateCuttingMetrics('24*18', '24*36')).toThrow();
  });
});
