import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  ProductCostGroupInput,
  ProductIngredientInput,
  ProductIngredientUpdateInput,
  ProductInput,
  ProductPricingInput,
} from '../../features/products/types';
import { db } from '../client';
import { ingredients, productCostGroups, productIngredients, products } from '../schema';

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
export async function listProductCostGroups() {
  return db.select().from(productCostGroups).orderBy(asc(productCostGroups.name));
}

export async function createProductCostGroup(input: ProductCostGroupInput) {
  const timestamp = getTimestamp();
  const result = await db
    .insert(productCostGroups)
    .values({
      name: input.name.trim(),
      monthlySharedCost: Math.max(Number(input.monthlySharedCost) || 0, 0),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning({ id: productCostGroups.id })
    .execute();
  return result[0].id;
}

export async function updateProductCostGroup(
  id: number,
  input: Partial<ProductCostGroupInput>,
) {
  await db
    .update(productCostGroups)
    .set({
      name: input.name ? input.name.trim() : undefined,
      monthlySharedCost:
        input.monthlySharedCost === undefined
          ? undefined
          : Math.max(Number(input.monthlySharedCost) || 0, 0),
      updatedAt: getTimestamp(),
    })
    .where(eq(productCostGroups.id, id))
    .execute();
}

export async function deleteProductCostGroup(id: number) {
  await db
    .update(products)
    .set({ costGroupId: null, updatedAt: getTimestamp() })
    .where(eq(products.costGroupId, id))
    .execute();

  await db.delete(productCostGroups).where(eq(productCostGroups.id, id)).execute();
}



export async function createProduct(input: ProductInput) {
  const result = await db
    .insert(products)
    .values({
      name: input.name.trim(),
      category: input.category,
      costGroupId: input.costGroupId ?? null,
      batchSize: input.batchSize,
      baseCost: input.baseCost,
      targetMargin: input.targetMargin,
      sellingPrice: input.sellingPrice,
      vatPercent: input.vatPercent,
      pricingMethod: input.pricingMethod,
      monthlyGoalProfit: input.monthlyGoalProfit,
      discountPercent: input.discountPercent ?? 0.20,
      monthlyOverhead: input.monthlyOverhead ?? 0,
      monthlyProductionQty: input.monthlyProductionQty ?? 0,
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
      costGroupId: input.costGroupId ?? null,
      batchSize: input.batchSize,
      baseCost: input.baseCost,
      targetMargin: input.targetMargin,
      sellingPrice: input.sellingPrice,
      vatPercent: input.vatPercent,
      pricingMethod: input.pricingMethod,
      monthlyGoalProfit: input.monthlyGoalProfit,
      discountPercent: input.discountPercent ?? 0.20,
      monthlyOverhead: input.monthlyOverhead ?? 0,
      monthlyProductionQty: input.monthlyProductionQty ?? 0,
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
  // Get the product's current group before trashing
  const existingRecords = await db.select({ costGroupId: products.costGroupId }).from(products).where(eq(products.id, id)).execute();
  const groupId = existingRecords[0]?.costGroupId;

  // Trash the product and remove from group
  await db
    .update(products)
    .set({
      deletedAt: getTimestamp(),
      updatedAt: getTimestamp(),
      costGroupId: null,
    })
    .where(eq(products.id, id))
    .execute();

  // If it was in a group, check if we need to dissolve it
  if (groupId) {
    const remainingInGroup = await db
      .select()
      .from(products)
      .where(and(eq(products.costGroupId, groupId), isNull(products.deletedAt)))
      .execute();

    if (remainingInGroup.length < 2) {
      await deleteProductCostGroup(groupId);
    }
  }
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
