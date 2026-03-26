export type OverheadLineItem = {
  id: string;
  label: string;
  amount: number;
};

export type OverheadData = {
  lines: OverheadLineItem[];
  contingencyPct: number; // 0–100
};

const newLineId = () => `oh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_LINES: () => OverheadLineItem[] = () => [
  { id: newLineId(), label: '', amount: 0 },
];

export function sumOverheadLines(lines: OverheadLineItem[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, Number(line.amount) || 0), 0);
}

export function computeOverheadTotal(data: OverheadData): number {
  const subtotal = sumOverheadLines(data.lines);
  const pct = Math.max(0, Math.min(100, data.contingencyPct || 0));
  return subtotal + subtotal * (pct / 100);
}

function parseLineArray(arr: any[]): OverheadLineItem[] {
  if (arr.length === 0) return DEFAULT_LINES();
  return arr.map((row: any, i: number) => ({
    id: String(row?.id ?? '').trim() || `oh-${i}-${Date.now()}`,
    label: String(row?.label ?? '').trim(),
    amount: Math.max(0, Number(row?.amount) || 0),
  }));
}

export function parseOverheadLinesJson(raw: string | null | undefined): OverheadData {
  if (!raw || !String(raw).trim()) {
    return { lines: DEFAULT_LINES(), contingencyPct: 0 };
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;

    // Legacy format: plain array
    if (Array.isArray(parsed)) {
      return { lines: parseLineArray(parsed), contingencyPct: 0 };
    }

    // New format: wrapper object { lines, contingencyPct }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).lines)) {
      const obj = parsed as any;
      return {
        lines: parseLineArray(obj.lines),
        contingencyPct: Math.max(0, Math.min(100, Number(obj.contingencyPct) || 0)),
      };
    }

    return { lines: DEFAULT_LINES(), contingencyPct: 0 };
  } catch {
    return { lines: DEFAULT_LINES(), contingencyPct: 0 };
  }
}

export function stringifyOverheadLines(data: OverheadData): string {
  return JSON.stringify({
    lines: data.lines.map((row) => ({
      id: row.id,
      label: row.label.trim() || 'Expense',
      amount: Math.max(0, Number(row.amount) || 0),
    })),
    contingencyPct: Math.max(0, Math.min(100, data.contingencyPct || 0)),
  });
}
