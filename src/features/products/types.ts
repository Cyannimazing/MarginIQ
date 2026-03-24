import { productCostGroups, products } from '../../db/schema';
import { COST_TYPES, PRODUCT_CATEGORIES } from '../../constants/productCategories';

export type PricingMethod = 'margin' | 'markup' | 'fixed';

export type Product = typeof products.$inferSelect;
export type ProductCostGroup = typeof productCostGroups.$inferSelect;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type CostType = (typeof COST_TYPES)[number];

export type ProductCostGroupInput = {
  name: string;
  monthlySharedCost: number;
};

export type ProductInput = {
  name: string;
  category: ProductCategory;
  batchSize: number;
  targetMargin: number;
  sellingPrice: number;
  vatPercent: number;
  pricingMethod: PricingMethod;
  monthlyGoalProfit: number;
  discountPercent?: number;
  monthlyOverhead?: number;
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
  costType: CostType;
};

export type ProductIngredientUpdateInput = {
  ingredientId: number;
  quantityUsed: number;
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
