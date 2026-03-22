const roundTo = (value: number, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeMargin = (targetMargin: number) => {
  if (!Number.isFinite(targetMargin)) {
    return 0;
  }

  return Math.min(Math.max(targetMargin, 0), 0.99);
};

const normalizeAmount = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

const normalizeUnits = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

export function calculateMinimumPrice(totalCost: number) {
  return roundTo(normalizeAmount(totalCost));
}

export function calculateSuggestedPrice(
  totalCost: number,
  targetValue: number,
  method: 'margin' | 'markup' | 'fixed' = 'margin'
) {
  const safeCost = normalizeAmount(totalCost);

  if (method === 'margin') {
    const safeMargin = normalizeMargin(targetValue);
    return roundTo(safeCost / (1 - safeMargin));
  } else if (method === 'markup') {
    const safeMarkup = Math.max(0, targetValue);
    return roundTo(safeCost * (1 + safeMarkup));
  } else if (method === 'fixed') {
    const safeFixed = Math.max(0, targetValue);
    return roundTo(safeCost + safeFixed);
  }

  return safeCost;
}

export function calculateProfitPerUnit(sellingPrice: number, totalCost: number) {
  return roundTo(normalizeAmount(sellingPrice) - normalizeAmount(totalCost));
}

export function calculateGrossMarginPercent(sellingPrice: number, totalCost: number) {
  const safeSellingPrice = normalizeAmount(sellingPrice);
  if (safeSellingPrice <= 0) {
    return 0;
  }

  return roundTo(((safeSellingPrice - normalizeAmount(totalCost)) / safeSellingPrice) * 100);
}

export function calculateMarkupPercent(sellingPrice: number, totalCost: number) {
  const safeTotalCost = normalizeAmount(totalCost);
  if (safeTotalCost <= 0) {
    return 0;
  }

  return roundTo(((normalizeAmount(sellingPrice) - safeTotalCost) / safeTotalCost) * 100);
}

export function calculateActualRevenue(sellingPrice: number, unitsSold: number) {
  return roundTo(normalizeAmount(sellingPrice) * normalizeUnits(unitsSold));
}

export function calculateBatchCostFromUnits(costPerUnit: number, unitsProduced: number) {
  return roundTo(normalizeAmount(costPerUnit) * normalizeUnits(unitsProduced));
}

export function calculateActualProfit(actualRevenue: number, totalBatchCost: number) {
  return roundTo(normalizeAmount(actualRevenue) - normalizeAmount(totalBatchCost));
}

export function calculateTargetProfit(targetRevenue: number, totalBatchCost: number) {
  return roundTo(normalizeAmount(targetRevenue) - normalizeAmount(totalBatchCost));
}

export function calculateShortfall(targetProfit: number, actualProfit: number) {
  return roundTo(normalizeAmount(targetProfit) - actualProfit);
}
