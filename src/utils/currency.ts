import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyOption,
} from '../constants/currencies';

const normalizeMoney = (value: number) => (Number.isFinite(value) ? value : 0);

export function getCurrencySymbol(currencyCode: string) {
  return getCurrencyOption(currencyCode).symbol;
}

export function formatMoney(value: number, currencyCode = DEFAULT_CURRENCY_CODE) {
  const safeValue = normalizeMoney(value);
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formatted}`;
}
