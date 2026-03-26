/** Pieces (recipe output) bundled into one customer sale — e.g. 6 donuts = 1 box. */
export function normalizeUnitsPerSale(raw: number | null | undefined, batchSize: number): number {
  const b = Math.max(Math.floor(Number(batchSize)) || 1, 1);
  const u = Math.floor(Number(raw));
  const safe = !Number.isFinite(u) || u < 1 ? 1 : u;
  return Math.min(safe, b);
}

export function salesPerBatch(batchSize: number, unitsPerSale: number): number {
  const b = Math.max(Number(batchSize) || 1, 1);
  const u = normalizeUnitsPerSale(unitsPerSale, b);
  return b / u;
}

export function perSaleCost(perPieceCost: number, unitsPerSale: number): number {
  const u = Math.max(Number(unitsPerSale) || 1, 1);
  return perPieceCost * u;
}

/** Label for logging / UI — uses custom name or falls back to generic. */
export function saleUnitDisplayName(saleUnitLabel: string | null | undefined, unitsPerSale: number): string {
  const t = (saleUnitLabel || '').trim();
  if (t) return t;
  if (unitsPerSale > 1) return `sale (${unitsPerSale} pcs)`;
  return 'unit';
}
