type NumericLike = number | string | { toString(): string } | null | undefined;

const BAG_BASE_COSTS: Record<string, number> = {
  SMALL: 5,
  MEDIUM: 5,
  LARGE: 10,
  XLARGE: 15,
};

const TWISTED_HANDLE_UNIT_COST = 65;

export interface OperationServiceSource {
  id: string;
  operationStage: string;
  operationName?: string | null;
  stageStatus?: string | null;
  createdAt?: Date | string | null;
  cutQuantity?: number | null;
  costPerCut?: NumericLike;
  numberOfDesigns?: number | null;
  ctpPlates?: number | null;
  ctpCostPerColor?: NumericLike;
  printImpressions?: number | null;
  printCostPerColor?: NumericLike;
  printCostPerImpression?: NumericLike;
  costPerDiecut?: NumericLike;
  laminationType?: string | null;
  glossCost?: NumericLike;
  matteCost?: NumericLike;
  laminationSheetsCount?: number | null;
  costPerFinish?: NumericLike;
  quantityFinished?: number | null;
  bagBaseSize?: string | null;
  twistedHandles?: number | null;
  costPerPackaging?: NumericLike;
  quantityItemFinished?: number | null;
}

export interface FactoryLabourServiceSource {
  id: string;
  workDate?: Date | string | null;
  typeOfFinishing?: string | null;
  quantityAllocated?: number | null;
  quantityFinished?: number | null;
  costPerFinish?: NumericLike;
}

export interface OperationServiceLine {
  operationId: string;
  operationStage: string;
  stageLabel: string;
  serviceSku: string;
  serviceName: string;
  operationName: string | null;
  stageStatus: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  quantitySource: string | null;
  sourceCostField: string | null;
}

const operationServiceDefinitions = {
  PAPER_SELECTION: {
    stageLabel: 'Paper Selection & Cutting',
    serviceSku: 'TPPC-SVC-PAPER-SELECTION',
    serviceName: 'Paper Selection & Cutting Service',
  },
  CUTTING: {
    stageLabel: 'Cutting (legacy)',
    serviceSku: 'TPPC-SVC-CUTTING',
    serviceName: 'Cutting Service',
  },
  ARTWORK_DESIGN: {
    stageLabel: 'Artwork / Design',
    serviceSku: 'TPPC-SVC-ARTWORK-DESIGN',
    serviceName: 'Artwork / Design Service',
  },
  CTP_MAKING: {
    stageLabel: 'CTP Making',
    serviceSku: 'TPPC-SVC-CTP-MAKING',
    serviceName: 'CTP Making Service',
  },
  PRINTING: {
    stageLabel: 'Printing',
    serviceSku: 'TPPC-SVC-PRINTING',
    serviceName: 'Printing Service',
  },
  DIECUTTING: {
    stageLabel: 'Die Cutting',
    serviceSku: 'TPPC-SVC-DIE-CUTTING',
    serviceName: 'Die Cutting Service',
  },
  LAMINATION: {
    stageLabel: 'Lamination',
    serviceSku: 'TPPC-SVC-LAMINATION',
    serviceName: 'Lamination Service',
  },
  FINISHING: {
    stageLabel: 'Finishing',
    serviceSku: 'TPPC-SVC-FINISHING',
    serviceName: 'Finishing Service',
  },
  PACKAGING: {
    stageLabel: 'Packaging',
    serviceSku: 'TPPC-SVC-PACKAGING',
    serviceName: 'Packaging Service',
  },
} as const;

export const operationServiceStages = Object.keys(
  operationServiceDefinitions,
) as Array<keyof typeof operationServiceDefinitions>;

function parseNumeric(value: NumericLike): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof value.toString === 'function'
  ) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveQuantity(
  value: number | null | undefined,
  fallback = 1,
): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback > 0 ? fallback : 0;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function isOperationServiceStage(
  stage: string | null | undefined,
): stage is keyof typeof operationServiceDefinitions {
  return (
    typeof stage === 'string' &&
    Object.prototype.hasOwnProperty.call(operationServiceDefinitions, stage)
  );
}

export function getOperationServiceDefinition(
  stage: string | null | undefined,
) {
  return isOperationServiceStage(stage)
    ? operationServiceDefinitions[stage]
    : null;
}

function buildOperationServiceLine(
  operation: OperationServiceSource,
  orderQuantity: number,
): OperationServiceLine | null {
  const definition = getOperationServiceDefinition(operation.operationStage);
  if (!definition) {
    return null;
  }

  const orderQuantityFallback = orderQuantity > 0 ? orderQuantity : 1;

  let quantity = 1;
  let unitCost = 0;
  let quantitySource: string | null = null;
  let sourceCostField: string | null = null;

  switch (operation.operationStage) {
    case 'PAPER_SELECTION': {
      // After Paper Selection and Cutting were merged into one stage,
      // the cutting cost (cutQuantity × costPerCut) rolls up here.
      const cutCount = parseNumeric(operation.cutQuantity);
      if (cutCount === null || cutCount <= 0) {
        // Nothing to bill for the service line when no cut quantity is set.
        return null;
      }
      quantity = cutCount;
      unitCost = parseNumeric(operation.costPerCut) ?? 0;
      quantitySource = 'cutQuantity';
      sourceCostField = unitCost > 0 ? 'costPerCut' : null;
      break;
    }
    case 'CUTTING': {
      quantity = resolveQuantity(operation.cutQuantity, orderQuantityFallback);
      unitCost = parseNumeric(operation.costPerCut) ?? 0;
      quantitySource = operation.cutQuantity ? 'cutQuantity' : 'orderQuantity';
      sourceCostField = unitCost > 0 ? 'costPerCut' : null;
      break;
    }
    case 'ARTWORK_DESIGN': {
      quantity = resolveQuantity(operation.numberOfDesigns, 1);
      quantitySource = operation.numberOfDesigns ? 'numberOfDesigns' : 'default';
      break;
    }
    case 'CTP_MAKING': {
      quantity = resolveQuantity(operation.ctpPlates, 1);
      unitCost = parseNumeric(operation.ctpCostPerColor) ?? 0;
      quantitySource = operation.ctpPlates ? 'ctpPlates' : 'default';
      sourceCostField = unitCost > 0 ? 'ctpCostPerColor' : null;
      break;
    }
    case 'PRINTING': {
      const impressionCost = parseNumeric(operation.printCostPerImpression);
      const colorCost = parseNumeric(operation.printCostPerColor);

      if (impressionCost !== null) {
        quantity = resolveQuantity(
          operation.printImpressions,
          orderQuantityFallback,
        );
        unitCost = impressionCost;
        quantitySource = operation.printImpressions
          ? 'printImpressions'
          : 'orderQuantity';
        sourceCostField = 'printCostPerImpression';
      } else {
        quantity = 1;
        unitCost = colorCost ?? 0;
        quantitySource = 'default';
        sourceCostField = colorCost !== null ? 'printCostPerColor' : null;
      }
      break;
    }
    case 'DIECUTTING': {
      // Workbook: cost is per diecut piece. Prefer cutQuantity (number of
      // pieces being diecut); fall back to printImpressions (legacy data),
      // then to the order quantity.
      quantity = resolveQuantity(
        operation.cutQuantity ?? operation.printImpressions,
        orderQuantityFallback,
      );
      unitCost = parseNumeric(operation.costPerDiecut) ?? 0;
      quantitySource = operation.cutQuantity
        ? 'cutQuantity'
        : operation.printImpressions
          ? 'printImpressions'
          : 'orderQuantity';
      sourceCostField = unitCost > 0 ? 'costPerDiecut' : null;
      break;
    }
    case 'LAMINATION': {
      const laminationType = (operation.laminationType ?? '').toUpperCase();
      const laminationCost = laminationType.includes('MATTE')
        ? parseNumeric(operation.matteCost)
        : parseNumeric(operation.glossCost);

      quantity = resolveQuantity(
        operation.laminationSheetsCount,
        orderQuantityFallback,
      );
      unitCost = laminationCost ?? 0;
      quantitySource = operation.laminationSheetsCount
        ? 'laminationSheetsCount'
        : 'orderQuantity';
      sourceCostField = laminationType.includes('MATTE')
        ? 'matteCost'
        : 'glossCost';
      break;
    }
    case 'FINISHING': {
      quantity = resolveQuantity(
        operation.quantityFinished,
        orderQuantityFallback,
      );
      const finishUnit = parseNumeric(operation.costPerFinish) ?? 0;
      // Workbook: bag base cost (small/medium=5, large=10, xlarge=15) applies
      // per finished bag and rolls into the finishing line total.
      const baseUnit =
        operation.bagBaseSize &&
        BAG_BASE_COSTS[operation.bagBaseSize.toUpperCase()] !== undefined
          ? BAG_BASE_COSTS[operation.bagBaseSize.toUpperCase()]
          : 0;
      // Workbook: twisted handles are a flat N65 per handle. The count is
      // a total (not per bag) so we add it to the line total directly.
      const twistedCount =
        typeof operation.twistedHandles === 'number' &&
        Number.isFinite(operation.twistedHandles) &&
        operation.twistedHandles > 0
          ? operation.twistedHandles
          : 0;
      unitCost = roundCurrency(finishUnit + baseUnit);
      // Encode the per-piece breakdown via unitCost; add handles flat cost
      // by faking quantity adjustment below.
      quantitySource = operation.quantityFinished
        ? 'quantityFinished'
        : 'orderQuantity';
      sourceCostField =
        finishUnit > 0
          ? 'costPerFinish'
          : baseUnit > 0
            ? 'bagBaseSize'
            : twistedCount > 0
              ? 'twistedHandles'
              : null;

      const normalizedUnitCost = unitCost;
      const totalCost = roundCurrency(
        normalizedUnitCost * quantity + twistedCount * TWISTED_HANDLE_UNIT_COST,
      );

      return {
        operationId: operation.id,
        operationStage: operation.operationStage,
        stageLabel: definition.stageLabel,
        serviceSku: definition.serviceSku,
        serviceName: definition.serviceName,
        operationName:
          typeof operation.operationName === 'string' &&
          operation.operationName.trim().length > 0
            ? operation.operationName.trim()
            : null,
        stageStatus: operation.stageStatus ?? null,
        quantity,
        unitCost: normalizedUnitCost,
        totalCost,
        quantitySource,
        sourceCostField,
      };
    }
    case 'PACKAGING': {
      quantity = resolveQuantity(
        operation.quantityItemFinished,
        orderQuantityFallback,
      );
      unitCost = parseNumeric(operation.costPerPackaging) ?? 0;
      quantitySource = operation.quantityItemFinished
        ? 'quantityItemFinished'
        : 'orderQuantity';
      sourceCostField = unitCost > 0 ? 'costPerPackaging' : null;
      break;
    }
    default:
      return null;
  }

  const normalizedUnitCost = roundCurrency(unitCost);
  const totalCost = roundCurrency(normalizedUnitCost * quantity);

  return {
    operationId: operation.id,
    operationStage: operation.operationStage,
    stageLabel: definition.stageLabel,
    serviceSku: definition.serviceSku,
    serviceName: definition.serviceName,
    operationName:
      typeof operation.operationName === 'string' &&
      operation.operationName.trim().length > 0
        ? operation.operationName.trim()
        : null,
    stageStatus: operation.stageStatus ?? null,
    quantity,
    unitCost: normalizedUnitCost,
    totalCost,
    quantitySource,
    sourceCostField,
  };
}

export function buildOperationServiceSummary(
  operations: OperationServiceSource[],
  orderQuantity: number,
) {
  const items = operations
    .map((operation) => buildOperationServiceLine(operation, orderQuantity))
    .filter((item): item is OperationServiceLine => item !== null)
    .sort((left, right) => {
      const leftStageIndex = operationServiceStages.indexOf(
        left.operationStage as keyof typeof operationServiceDefinitions,
      );
      const rightStageIndex = operationServiceStages.indexOf(
        right.operationStage as keyof typeof operationServiceDefinitions,
      );

      if (leftStageIndex !== rightStageIndex) {
        return leftStageIndex - rightStageIndex;
      }

      return left.serviceName.localeCompare(right.serviceName);
    });

  return {
    items,
    total: roundCurrency(items.reduce((sum, item) => sum + item.totalCost, 0)),
  };
}

export function buildFactoryLabourServiceSummary(
  activities: FactoryLabourServiceSource[],
) {
  const items = activities
    .map<OperationServiceLine | null>((activity) => {
      const quantity = resolveQuantity(activity.quantityFinished, 0);
      const unitCost = roundCurrency(parseNumeric(activity.costPerFinish) ?? 0);
      const totalCost = roundCurrency(quantity * unitCost);

      if (quantity <= 0 && totalCost <= 0) {
        return null;
      }

      return {
        operationId: activity.id,
        operationStage: 'FACTORY_LABOUR',
        stageLabel: 'Factory Labour',
        serviceSku: 'TPPC-SVC-FACTORY-LABOUR',
        serviceName: 'Factory Labour Service',
        operationName:
          typeof activity.typeOfFinishing === 'string' &&
          activity.typeOfFinishing.trim().length > 0
            ? activity.typeOfFinishing.trim()
            : null,
        stageStatus: 'COMPLETE',
        quantity,
        unitCost,
        totalCost,
        quantitySource:
          activity.quantityFinished && activity.quantityFinished > 0
            ? 'quantityFinished'
            : activity.quantityAllocated && activity.quantityAllocated > 0
              ? 'quantityAllocated'
              : null,
        sourceCostField: unitCost > 0 ? 'costPerFinish' : null,
      } satisfies OperationServiceLine;
    })
    .filter((item): item is OperationServiceLine => item !== null)
    .sort((left, right) => left.operationId.localeCompare(right.operationId));

  return {
    items,
    total: roundCurrency(items.reduce((sum, item) => sum + item.totalCost, 0)),
  };
}