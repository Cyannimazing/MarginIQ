import { productCostGroups, productSalePackages, products } from '../../db/schema';
import { COST_TYPES, PRODUCT_CATEGORIES } from '../../constants/productCategories';

export type PricingMethod = 'margin' | 'markup' | 'fixed';

export type Product = typeof products.$inferSelect;
export type ProductCostGroup = typeof productCostGroups.$inferSelect;
export type ProductSalePackage = typeof productSalePackages.$inferSelect;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type CostType = (typeof COST_TYPES)[number];

export type ProductCostGroupInput = {
  name: string;
  monthlySharedCost: number;
  /** JSON from stringifyOverheadLines */
  monthlySharedCostBreakdown?: string;
};

export type ProductSalePackageInput = {
  productId: number;
  name: string;
  piecesPerPackage: number;
};

export type ProductInput = {
  name: string;
  category: ProductCategory;
  batchSize: number;
  /** Pieces per sale; default 1. */
  unitsPerSale?: number;
  saleUnitLabel?: string;
  targetMargin: number;
  sellingPrice: number;
  vatPercent: number;
  pricingMethod: PricingMethod;
  monthlyGoalProfit: number;
  discountPercent?: number;
  monthlyOverhead?: number;
  /** JSON from stringifyOverheadLines */
  monthlyOverheadBreakdown?: string;
  monthlyProductionQty?: number;
  costGroupId?: number | null;
  baseCost: number;
  isPinned?: boolean;
  color?: string;
  isArchived?: boolean;
  deletedAt?: string | null;
};

export type ProductPricingInput = {
  targetMargin: number;
  sellingPrice: number;
};

export type ProductIngredientInput = {
  productId: number;
  ingredientId: number;
  quantityUsed: number;
  usageMode: 'per_piece' | 'pieces_per_unit' | 'per_batch';
  usageRatio: number;
  costType: CostType;
};

export type ProductIngredientUpdateInput = {
  ingredientId: number;
  quantityUsed: number;
  usageMode?: 'per_piece' | 'pieces_per_unit' | 'per_batch';
  usageRatio?: number;
  costType: CostType;
};

export type ProductIngredientRow = {
  id: number;
  productId: number;
  ingredientId: number;
  ingredientName: string;
  ingredientUnit: string;
  ingredientPricePerUnit: number;
  ingredientQuantity: number;
  ingredientYieldFactor: number;
  ingredientClassification: 'measurable' | 'fixed';
  quantityUsed: number;
  usageMode: 'per_piece' | 'pieces_per_unit' | 'per_batch';
  usageRatio: number;
  costType: CostType;
};

export type ProductCostBreakdown = {
  baseCost: number;
  materialCost: number;
  packagingCost: number;
  overheadCost: number;
  laborCost: number;
  utilitiesCost: number;
  otherCost: number;
  subtotal: number;
  vatAmount: number;
  totalCost: number;
};
