import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyOption,
} from '../constants/currencies';

const normalizeMoney = (value: number) => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return 0;
  return value;
};

export function getCurrencySymbol(currencyCode: string) {
  return getCurrencyOption(currencyCode).symbol;
}

export function formatMoney(value: number, currencyCode = DEFAULT_CURRENCY_CODE, maxDigits = 2) {
  const safeValue = normalizeMoney(value);
  const symbol = getCurrencySymbol(currencyCode);
  
  try {
    const formatted = safeValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.max(2, isFinite(maxDigits) ? maxDigits : 2),
    });
    return `${symbol}${formatted}`;
  } catch (err) {
    // Fallback if toLocaleString fails or maxDigits is invalid
    return `${symbol}${safeValue.toFixed(2)}`;
  }
}
