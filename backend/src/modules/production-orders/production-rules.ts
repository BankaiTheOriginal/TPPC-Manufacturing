import { BadRequestException } from '@nestjs/common';

type PaperRule = {
  itemId?: string;
  sku?: string;
  itemName?: string;
  category?: string;
  quantityInStock?: number;
  paperType: string;
  sourceSheetSize: string;
  costPerPacket?: number | null;
  sheetsPerPacket?: number | null;
  costPerSheet?: number | null;
};

type RangeCostRule = {
  min: number;
  max: number;
  cost: number;
};

type LaminationRule = {
  size: string;
  glossCost: number;
  matteCost: number;
};

type FinishRule = {
  itemFinished: string;
  costPerFinish: number;
};

type BagBaseRule = {
  size: string;          // SMALL | MEDIUM | LARGE | XLARGE
  label: string;         // Human label for UI
  costPerBag: number;    // ₦ per bag base
};

const PAPER_RULES: PaperRule[] = [
  {
    paperType: 'FBB 250gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 47000,
    sheetsPerPacket: 100,
    costPerSheet: 470,
  },
  {
    paperType: 'FBB 270gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 50000,
    sheetsPerPacket: 100,
    costPerSheet: 500,
  },
  {
    paperType: 'FBB 300gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 55000,
    sheetsPerPacket: 100,
    costPerSheet: 550,
  },
  {
    paperType: 'FBB 350gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 60000,
    sheetsPerPacket: 100,
    costPerSheet: 600,
  },
  {
    paperType: 'FBB 400gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 65000,
    sheetsPerPacket: 100,
    costPerSheet: 650,
  },
  {
    paperType: 'Chipboard 300gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 25500,
    sheetsPerPacket: 100,
    costPerSheet: 255,
  },
  {
    paperType: 'Chipboard 350gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 27500,
    sheetsPerPacket: 100,
    costPerSheet: 275,
  },
  {
    paperType: 'Art 135gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 28000,
    sheetsPerPacket: 500,
    costPerSheet: 56,
  },
  {
    paperType: 'Art 150gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 30000,
    sheetsPerPacket: 500,
    costPerSheet: 60,
  },
  {
    paperType: 'Matte 135gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 30000,
    sheetsPerPacket: 500,
    costPerSheet: 60,
  },
  {
    paperType: 'Matte 150gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 34000,
    sheetsPerPacket: 500,
    costPerSheet: 68,
  },
  {
    paperType: 'Bond 80gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 48000,
    sheetsPerPacket: 500,
    costPerSheet: 96,
  },
  {
    paperType: 'Bond 100gsm',
    sourceSheetSize: '24x36',
    costPerPacket: 55000,
    sheetsPerPacket: 500,
    costPerSheet: 110,
  },
  {
    paperType: 'Sticker paper',
    sourceSheetSize: '20x30',
    costPerPacket: 20000,
    sheetsPerPacket: 100,
    costPerSheet: 200,
  },
  {
    paperType: 'White gpp 50gsm',
    sourceSheetSize: '24x18',
    costPerPacket: 45000,
    sheetsPerPacket: 500,
    costPerSheet: 90,
  },
  {
    paperType: 'Brown gpp 50gsm',
    sourceSheetSize: '24x18',
    costPerPacket: 50000,
    sheetsPerPacket: 500,
    costPerSheet: 100,
  },
  {
    paperType: 'Kraft paper 110gsm 31X42"',
    sourceSheetSize: '31x42',
    costPerPacket: 24000,
    sheetsPerPacket: 100,
    costPerSheet: 240,
  },
  {
    paperType: 'Kraft paper 110gsm 36X47"',
    sourceSheetSize: '36x47',
    costPerPacket: 35000,
    sheetsPerPacket: 100,
    costPerSheet: 350,
  },
  {
    paperType: 'Kraft card 300gsm',
    sourceSheetSize: '36x48',
    costPerPacket: 85000,
    sheetsPerPacket: 100,
    costPerSheet: 850,
  },
  {
    paperType: 'kraft paper 60gsm',
    sourceSheetSize: '24x40',
    costPerPacket: 65000,
    sheetsPerPacket: 460,
    costPerSheet: 141.3,
  },
];

const CUT_SIZES = [
  '16x18',
  '13.5x15.5',
  '10x20.5',
  '10x15.5',
  '12x24',
  '12x12',
  '14x14',
  '12x22',
  '12x18',
  '12x9',
  '6x9',
  '10x10',
  '11x14',
  '18x24',
  '18x81',
  '24x36',
];

const CUT_COST_RULES: RangeCostRule[] = [
  { min: 1, max: 6, cost: 7 },
  { min: 7, max: 16, cost: 5 },
  { min: 17, max: 48, cost: 2.5 },
];

const DIECUT_COST_RULES: RangeCostRule[] = [
  { min: 1, max: 6, cost: 15 },
  { min: 7, max: 16, cost: 6 },
  { min: 17, max: 48, cost: 4 },
];

const CTP_RULES = [
  { machine: 'Kord', costPerColor: 1750 },
  { machine: 'MO', costPerColor: 1750 },
  { machine: 'Sord', costPerColor: 2000 },
  { machine: 'SM', costPerColor: 5000 },
  { machine: 'ADAZ', costPerColor: 1750 },
];

const PRINT_RULES = [
  { machine: 'Kord', costPerColor: 2000 },
  { machine: 'MO', costPerColor: 4000 },
  { machine: 'Sord', costPerColor: 6000 },
  { machine: 'SM', costPerColor: 7500 },
  { machine: 'DI paper print', costPerColor: 350 },
  { machine: 'DI card print', costPerColor: 500 },
  { machine: 'Screenprinting', costPerColor: 60 },
  { machine: 'ADAZ', costPerColor: 2000 },
];

const LAMINATION_RULES: LaminationRule[] = [
  { size: '16x18', glossCost: 40, matteCost: 50 },
  { size: '13.5x15.5', glossCost: 18, matteCost: 24 },
  { size: '10x20.5', glossCost: 15, matteCost: 18 },
  { size: '10x15.5', glossCost: 14, matteCost: 17 },
  { size: '12x24', glossCost: 25, matteCost: 30 },
  { size: '12x12', glossCost: 12, matteCost: 15 },
  { size: '14x14', glossCost: 18, matteCost: 22 },
  { size: '12x22', glossCost: 25, matteCost: 30 },
  { size: '12x18', glossCost: 18, matteCost: 22 },
  { size: '12x9', glossCost: 10, matteCost: 15 },
  { size: '6x9', glossCost: 8, matteCost: 15 },
  { size: '10x10', glossCost: 14, matteCost: 18 },
  { size: '11x14', glossCost: 18, matteCost: 22 },
  { size: '18x24', glossCost: 40, matteCost: 45 },
  { size: '18x81', glossCost: 42, matteCost: 48 },
  { size: '24x36', glossCost: 50, matteCost: 55 },
];

const FINISH_RULES: FinishRule[] = [
  { itemFinished: 'paper bags', costPerFinish: 18 },
  { itemFinished: 'paper boxes', costPerFinish: 12 },
  { itemFinished: 'sanack papers', costPerFinish: 5 },
  { itemFinished: 'Consumables', costPerFinish: 4 },
];

// Workbook: Bag base — small/medium bag = N5, large bag = N10, xlarge bag = N15
const BAG_BASE_RULES: BagBaseRule[] = [
  { size: 'SMALL', label: 'Small bag', costPerBag: 5 },
  { size: 'MEDIUM', label: 'Medium bag', costPerBag: 5 },
  { size: 'LARGE', label: 'Large bag', costPerBag: 10 },
  { size: 'XLARGE', label: 'XLarge bag', costPerBag: 15 },
];

// Workbook: Twisted handles — N65 per handle (flat unit cost)
export const TWISTED_HANDLE_UNIT_COST = 65;

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function normalizeSize(size?: string | null) {
  if (!size) return undefined;

  const normalized = size
    .toLowerCase()
    .replace(/"/g, '')
    .replace(/\u00d7/g, 'x')
    .replace(/\*/g, 'x')
    .replace(/\s+/g, '');

  return normalized || undefined;
}

export function toStorageSize(size: string) {
  return normalizeSize(size)?.replace(/x/g, '*');
}

export function extractSourceSheetSize(value?: string | null) {
  if (!value) return undefined;

  const match = String(value)
    .replace(/"/g, '')
    .match(/(\d+(?:\.\d+)?)\s*(?:x|\u00d7|\*)\s*(\d+(?:\.\d+)?)/i);

  if (!match) return undefined;

  return normalizeSize(`${match[1]}x${match[2]}`);
}

function decimalToNumber(
  value?: number | string | { toString(): string } | null,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed =
    typeof value === 'number' ? value : Number(value.toString().trim());
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function buildPaperRuleFromInventoryItem(item: {
  id?: string;
  sku?: string;
  itemName?: string;
  category?: string;
  quantityInStock?: number;
  averagePrice?: number | string | { toString(): string } | null;
  price?: number | string | { toString(): string } | null;
}): PaperRule | null {
  const itemName = item.itemName?.trim();
  const sourceSheetSize = extractSourceSheetSize(itemName);

  if (!itemName || !sourceSheetSize) {
    return null;
  }

  const costPerSheet = decimalToNumber(item.averagePrice);
  const costPerPacket = decimalToNumber(item.price);
  const inferredSheetsPerPacket =
    costPerSheet && costPerPacket && costPerSheet > 0
      ? Math.round(costPerPacket / costPerSheet)
      : undefined;

  return {
    itemId: item.id,
    sku: item.sku,
    itemName,
    category: item.category,
    quantityInStock: item.quantityInStock,
    paperType: itemName,
    sourceSheetSize,
    costPerPacket,
    sheetsPerPacket:
      inferredSheetsPerPacket && inferredSheetsPerPacket > 0
        ? inferredSheetsPerPacket
        : null,
    costPerSheet,
  };
}

function parseSize(size: string) {
  const normalized = normalizeSize(size);
  if (!normalized) {
    throw new BadRequestException('Size is required');
  }

  const [length, breadth] = normalized.split('x').map(Number);

  if (
    !Number.isFinite(length) ||
    !Number.isFinite(breadth) ||
    length <= 0 ||
    breadth <= 0
  ) {
    throw new BadRequestException(`Invalid size "${size}"`);
  }

  return { length, breadth, normalized };
}

function resolveRangeCost(count: number, rules: RangeCostRule[]) {
  return rules.find((rule) => count >= rule.min && count <= rule.max)?.cost;
}

export function calculateCuttingMetrics(
  sourceSheetSize: string,
  cutSize: string,
  costPerSheet?: number | null,
) {
  const source = parseSize(sourceSheetSize);
  const cut = parseSize(cutSize);

  const rawCutOuts =
    (source.length / cut.length) * (source.breadth / cut.breadth);
  const cutOuts = Math.floor(rawCutOuts);

  if (!Number.isFinite(rawCutOuts) || cutOuts < 1) {
    throw new BadRequestException(
      `Cut size ${cutSize} does not fit inside source sheet ${sourceSheetSize}`,
    );
  }

  const costPerCut = resolveRangeCost(cutOuts, CUT_COST_RULES);
  const costPerDiecut = resolveRangeCost(cutOuts, DIECUT_COST_RULES);

  return {
    sourceSheetSize: toStorageSize(source.normalized)!,
    cutSize: toStorageSize(cut.normalized)!,
    rawCutOuts: roundToFour(rawCutOuts),
    maxCutOutsPerSheet: cutOuts,
    cutOuts,
    bagSheets: Math.floor(cutOuts / 2),
    costPerCut: costPerCut ? roundToTwo(costPerCut) : null,
    costPerDiecut: costPerDiecut ? roundToTwo(costPerDiecut) : null,
    costOfPaperUsed:
      typeof costPerSheet === 'number' && Number.isFinite(costPerSheet)
        ? roundToTwo(costPerSheet / cutOuts)
        : null,
  };
}

export function calculateSheetFractionUsed(
  requestedCuts: number,
  maxCutOutsPerSheet: number,
) {
  if (!Number.isFinite(requestedCuts) || requestedCuts < 0) {
    throw new BadRequestException('requestedCuts must be zero or more');
  }

  if (!Number.isFinite(maxCutOutsPerSheet) || maxCutOutsPerSheet <= 0) {
    throw new BadRequestException(
      'maxCutOutsPerSheet must be a positive number',
    );
  }

  return roundToFour(requestedCuts / maxCutOutsPerSheet);
}

export function calculateRemainingCutCapacity(
  maxCutOutsPerSheet: number,
  requestedCuts: number,
) {
  if (!Number.isFinite(requestedCuts) || requestedCuts < 0) {
    throw new BadRequestException('requestedCuts must be zero or more');
  }

  if (!Number.isFinite(maxCutOutsPerSheet) || maxCutOutsPerSheet <= 0) {
    throw new BadRequestException(
      'maxCutOutsPerSheet must be a positive number',
    );
  }

  return Math.max(maxCutOutsPerSheet - requestedCuts, 0);
}

export function calculateSourceSheetsRequired(
  outputQuantity: number,
  cutOuts: number,
) {
  if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
    return 0;
  }

  if (!Number.isFinite(cutOuts) || cutOuts <= 0) {
    throw new BadRequestException('cutOuts must be a positive number');
  }

  return Math.ceil(outputQuantity / cutOuts);
}

export function getProductionRules(paperRules: PaperRule[] = PAPER_RULES) {
  const sourcePaperRules =
    Array.isArray(paperRules) && paperRules.length > 0
      ? paperRules
      : PAPER_RULES;
  const sourceSheetSizes = [
    ...new Set(sourcePaperRules.map((rule) => rule.sourceSheetSize)),
  ];

  const paperItems = sourcePaperRules.map((rule) => ({
    itemId: rule.itemId ?? null,
    sku: rule.sku ?? null,
    itemName: rule.itemName ?? rule.paperType,
    category: rule.category ?? null,
    quantityInStock: rule.quantityInStock ?? null,
    paperType: rule.paperType,
    sourceSheetSize: toStorageSize(rule.sourceSheetSize)!,
    sourceSheetSizeLabel: rule.sourceSheetSize,
    costPerPacket:
      typeof rule.costPerPacket === 'number'
        ? roundToTwo(rule.costPerPacket)
        : null,
    sheetsPerPacket: rule.sheetsPerPacket ?? null,
    costPerSheet:
      typeof rule.costPerSheet === 'number'
        ? roundToTwo(rule.costPerSheet)
        : null,
  }));

  return {
    paperItems,
    paperTypes: paperItems,
    sourceSheetSizes: sourceSheetSizes.map((size) => ({
      value: toStorageSize(size)!,
      label: size,
    })),
    cutSizes: CUT_SIZES.map((size) => ({
      value: toStorageSize(size)!,
      label: size,
    })),
    cutCostRules: CUT_COST_RULES.map((rule) => ({
      range: `${rule.min}-${rule.max}`,
      cost: roundToTwo(rule.cost),
    })),
    diecutCostRules: DIECUT_COST_RULES.map((rule) => ({
      range: `${rule.min}-${rule.max}`,
      cost: roundToTwo(rule.cost),
    })),
    ctp: CTP_RULES,
    print: PRINT_RULES,
    lamination: LAMINATION_RULES.map((rule) => ({
      size: toStorageSize(rule.size)!,
      sizeLabel: rule.size,
      glossCost: roundToTwo(rule.glossCost),
      matteCost: roundToTwo(rule.matteCost),
    })),
    finishing: FINISH_RULES.map((rule) => ({
      itemFinished: rule.itemFinished,
      costPerFinish: roundToTwo(rule.costPerFinish),
    })),
    bagBase: BAG_BASE_RULES.map((rule) => ({
      size: rule.size,
      label: rule.label,
      costPerBag: roundToTwo(rule.costPerBag),
    })),
    twistedHandles: {
      unitCost: roundToTwo(TWISTED_HANDLE_UNIT_COST),
      description: 'Flat cost per twisted handle',
    },
    formulas: {
      cutOuts: 'No of cut outs = (L0 / L) x (B0 / B)',
      bagSheets: 'No of bag sheets = No of cut outs / 2',
      sourceSheetsRequired:
        'Source sheets required = ceiling(order quantity / no of cut outs)',
      paperCostUsed: 'Cost of paper used = cost per sheet / no of cut outs',
      note: 'Partial cut outs are rounded down to the nearest whole number.',
    },
  };
}

export function isKnownCutSize(size: string) {
  const normalized = normalizeSize(size);
  return !!normalized && CUT_SIZES.includes(normalized);
}

export function isKnownSourceSheetSize(size: string) {
  return !!normalizeSize(size);
}
