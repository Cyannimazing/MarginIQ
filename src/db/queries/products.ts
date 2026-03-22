import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  ProductIngredientInput,
  ProductIngredientUpdateInput,
  ProductInput,
  ProductPricingInput,
} from '../../features/products/types';
import { db } from '../client';
import { ingredients, productIngredients, products } from '../schema';

const getTimestamp = () => new Date().toISOString();

export async function listProducts() {
  return db
    .select()
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.name));
}

// Fixed version:
export async function listActiveProducts() {
  return db.select().from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name));
}



export async function createProduct(input: ProductInput) {
  const result = await db
    .insert(products)
    .values({
      name: input.name.trim(),
      category: input.category,
      batchSize: input.batchSize,
      baseCost: input.baseCost,
      targetMargin: input.targetMargin,
      sellingPrice: input.sellingPrice,
      vatPercent: input.vatPercent,
      pricingMethod: input.pricingMethod,
      monthlyGoalProfit: input.monthlyGoalProfit,
      isPinned: input.isPinned ?? false,
      color: input.color ?? '',
      isArchived: input.isArchived ?? false,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    })
    .returning({ id: products.id })
    .execute();
  return result[0].id;
}

export async function updateProduct(id: number, input: ProductInput) {
  await db
    .update(products)
    .set({
      name: input.name.trim(),
      category: input.category,
      batchSize: input.batchSize,
      baseCost: input.baseCost,
      targetMargin: input.targetMargin,
      sellingPrice: input.sellingPrice,
      vatPercent: input.vatPercent,
      pricingMethod: input.pricingMethod,
      monthlyGoalProfit: input.monthlyGoalProfit,
      updatedAt: getTimestamp(),
    })
    .where(eq(products.id, id))
    .execute();
}

export async function updateProductPricing(id: number, input: ProductPricingInput) {
  await db
    .update(products)
    .set({
      targetMargin: input.targetMargin,
      sellingPrice: input.sellingPrice,
      updatedAt: getTimestamp(),
    })
    .where(eq(products.id, id))
    .execute();
}

export async function trashProduct(id: number) {
  await db
    .update(products)
    .set({
      deletedAt: getTimestamp(),
      updatedAt: getTimestamp(),
    })
    .where(eq(products.id, id))
    .execute();
}

export async function restoreProduct(id: number) {
  await db
    .update(products)
    .set({
      deletedAt: null,
      updatedAt: getTimestamp(),
    })
    .where(eq(products.id, id))
    .execute();
}

export async function listTrashProducts() {
  return db
    .select()
    .from(products)
    .where(isNotNull(products.deletedAt))
    .orderBy(asc(products.deletedAt));
}



export async function updateProductDetails(id: number, input: Partial<ProductInput>) {
  await db
    .update(products)
    .set({
      ...input,
      name: input.name ? input.name.trim() : undefined,
      updatedAt: getTimestamp(),
    })
    .where(eq(products.id, id))
    .execute();
}

export async function deleteProduct(id: number) {
  await db.delete(productIngredients).where(eq(productIngredients.productId, id)).execute();
  await db.delete(products).where(eq(products.id, id)).execute();
}

export async function listProductIngredientRows(productId: number) {
  return db
    .select({
      id: productIngredients.id,
      productId: productIngredients.productId,
      ingredientId: productIngredients.ingredientId,
      ingredientName: ingredients.name,
      ingredientUnit: ingredients.unit,
      ingredientPricePerUnit: ingredients.pricePerUnit,
      ingredientQuantity: ingredients.quantity,
      ingredientYieldFactor: ingredients.yieldFactor,
      ingredientClassification: ingredients.classification,
      quantityUsed: productIngredients.quantityUsed,
      costType: productIngredients.costType,
    })
    .from(productIngredients)
    .innerJoin(ingredients, eq(productIngredients.ingredientId, ingredients.id))
    .where(eq(productIngredients.productId, productId))
    .orderBy(asc(ingredients.name));
}

export async function addProductIngredient(input: ProductIngredientInput) {
  await db
    .insert(productIngredients)
    .values({
      productId: input.productId,
      ingredientId: input.ingredientId,
      quantityUsed: input.quantityUsed,
      costType: input.costType as any,
    })
    .execute();
}

export async function bulkAddProductIngredients(inputs: ProductIngredientInput[]) {
  if (inputs.length === 0) return;
  await db
    .insert(productIngredients)
    .values(
      inputs.map((i) => ({
        productId: i.productId,
        ingredientId: i.ingredientId,
        quantityUsed: i.quantityUsed,
        costType: i.costType as any,
      })),
    )
    .execute();
}

export async function updateProductIngredient(
  rowId: number,
  productId: number,
  input: ProductIngredientUpdateInput,
) {
  await db
    .update(productIngredients)
    .set({
      ingredientId: input.ingredientId,
      quantityUsed: input.quantityUsed,
      costType: input.costType,
    })
    .where(
      and(eq(productIngredients.id, rowId), eq(productIngredients.productId, productId)),
    )
    .execute();
}

export async function removeProductIngredient(rowId: number, productId: number) {
  await db
    .delete(productIngredients)
    .where(
      and(eq(productIngredients.id, rowId), eq(productIngredients.productId, productId)),
    )
    .execute();
}
