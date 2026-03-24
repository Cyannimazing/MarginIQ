import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { ingredients, productIngredients } from '../schema';
import { IngredientInput } from '../../features/ingredients/types';

const getTimestamp = () => new Date().toISOString();

export async function listAllIngredients() {
  return db.select().from(ingredients).orderBy(asc(ingredients.name));
}

// Always returns the full global library regardless of productId
export async function listIngredients(_productId?: number) {
  return listAllIngredients();
}

export async function addIngredient(input: IngredientInput) {
  const [result] = await db
    .insert(ingredients)
    .values({
      productId: 0, // all resources are global
      name: input.name.trim(),
      unit: input.unit,
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit,
      yieldFactor: input.yieldFactor ?? 1,
      classification: input.classification || 'measurable',
      tag: input.tag ?? 'Other',
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    })
    .returning({ id: ingredients.id })
    .execute();
  return result.id;
}

export async function updateIngredient(id: number, input: IngredientInput) {
  await db
    .update(ingredients)
    .set({
      name: input.name.trim(),
      unit: input.unit,
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit,
      yieldFactor: input.yieldFactor,
      classification: input.classification,
      tag: input.tag ?? 'Other',
      updatedAt: getTimestamp(),
    })
    .where(eq(ingredients.id, id))
    .execute();
}

export async function deleteIngredient(id: number) {
  // Cascade: remove all product composition links first
  await db.delete(productIngredients).where(eq(productIngredients.ingredientId, id)).execute();
  await db.delete(ingredients).where(eq(ingredients.id, id)).execute();
}
