import { ingredients } from '../../db/schema';
import { INGREDIENT_UNITS } from '../../constants/units';

export type Ingredient = typeof ingredients.$inferSelect;

export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export type ResourceClassification = 'measurable' | 'fixed';

export type IngredientInput = {
  productId: number;
  name: string;
  unit: IngredientUnit;
  quantity: number;
  pricePerUnit: number;
  yieldFactor: number;
  classification: ResourceClassification;
};
