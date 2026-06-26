type DecimalLike = number | string | { toString(): string } | null | undefined;

export function parseFactoryWorkerNames(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return raw ? [raw] : [];
  }
}

export function parseFactoryCurrency(value: DecimalLike): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof value.toString === 'function'
  ) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function calculateFactoryActivityTotal(params: {
  quantityFinished?: number | null;
  costPerFinish?: DecimalLike;
}) {
  const quantity =
    typeof params.quantityFinished === 'number' &&
    Number.isFinite(params.quantityFinished) &&
    params.quantityFinished > 0
      ? params.quantityFinished
      : 0;
  const unitCost = parseFactoryCurrency(params.costPerFinish);

  return Number((quantity * unitCost).toFixed(2));
}