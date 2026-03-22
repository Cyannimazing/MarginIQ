import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { ingredients } from '../schema';
import { IngredientInput } from '../../features/ingredients/types';

const getTimestamp = () => new Date().toISOString();

export async function listAllIngredients() {
  return db.select().from(ingredients).orderBy(asc(ingredients.name));
}

export async function listIngredients(productId?: number) {
  if (productId === undefined || productId === 0) return listAllIngredients();
  return db.select().from(ingredients).where(eq(ingredients.productId, productId)).orderBy(asc(ingredients.name));
}

export async function addIngredient(input: IngredientInput) {
  const [result] = await db
    .insert(ingredients)
    .values({
      productId: input.productId,
      name: input.name.trim(),
      unit: input.unit,
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit,
      yieldFactor: input.yieldFactor ?? 1,
      classification: input.classification || 'measurable',
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
      updatedAt: getTimestamp(),
    })
    .where(eq(ingredients.id, id))
    .execute();
}

export async function deleteIngredient(id: number) {
  await db.delete(ingredients).where(eq(ingredients.id, id)).execute();
}
