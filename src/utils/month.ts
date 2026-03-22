const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function isValidMonth(value: string) {
  return MONTH_REGEX.test(value.trim());
}

export function compareMonths(a: string, b: string) {
  return a.localeCompare(b);
}

export function isMonthInRange(month: string, startMonth: string, endMonth: string) {
  const target = month.trim();
  const start = startMonth.trim();
  const end = endMonth.trim();

  if (!isValidMonth(target) || !isValidMonth(start) || !isValidMonth(end)) {
    return false;
  }

  if (compareMonths(start, end) > 0) {
    return false;
  }

  return compareMonths(target, start) >= 0 && compareMonths(target, end) <= 0;
}

export function getDaysLeftInMonth(month: string) {
  if (!isValidMonth(month)) {
    return 0;
  }

  const now = new Date();
  const [year, monthPart] = month.split('-').map(Number);
  const monthIndex = (monthPart ?? 1) - 1;
  const endOfMonth = new Date(year ?? now.getFullYear(), monthIndex + 1, 0);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEndDate = new Date(
    endOfMonth.getFullYear(),
    endOfMonth.getMonth(),
    endOfMonth.getDate(),
  );

  const diffMs = startOfEndDate.getTime() - startOfToday.getTime();
  if (diffMs < 0) {
    return 0;
  }

  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}
