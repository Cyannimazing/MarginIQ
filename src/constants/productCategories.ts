export const PRODUCT_CATEGORIES = [
  'Beverages',
  'Food',
  'Desserts',
  'Snacks',
  'Pastries',
  'Others',
] as const;

export const COST_TYPES = ['ingredients', 'material', 'packaging', 'overhead', 'labor', 'utilities', 'other'] as const;

export const RESOURCE_TAGS = ['Raw Material', 'Packaging', 'Labor', 'Utilities', 'Other'] as const;
export type ResourceTag = (typeof RESOURCE_TAGS)[number];

export const RESOURCE_TAG_LABELS: Record<ResourceTag, string> = {
  'Raw Material': 'Raw Material',
  'Packaging': 'Consumables & Packaging',
  'Labor': 'Labor',
  'Utilities': 'Utilities',
  'Other': 'Other',
};
