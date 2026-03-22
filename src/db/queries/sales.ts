import { and, desc, eq } from 'drizzle-orm';
import { MonthlySaleInput } from '../../features/sales/types';
import { syncGoalEarnedForMonth } from './goals';
import { db } from '../client';
import { monthlySales } from '../schema';

const getTimestamp = () => new Date().toISOString();

export async function listMonthlySales() {
  return db
    .select()
    .from(monthlySales)
    .orderBy(desc(monthlySales.month), desc(monthlySales.recordedAt));
}

export async function addMonthlySale(input: MonthlySaleInput) {
  const now = getTimestamp();

  await db
    .insert(monthlySales)
    .values({
      productId: input.productId,
      month: input.month,
      unitsSold: input.unitsSold,
      unitsUnsold: input.unitsUnsold,
      actualRevenue: input.actualRevenue,
      actualCost: input.actualCost,
      actualProfit: input.actualProfit,
      targetProfit: input.targetProfit,
      shortfall: input.shortfall,
      recordedAt: now,
    })
    .execute();
  await syncGoalEarnedForMonth(input.month);
}

export async function deleteMonthlySale(id: number) {
  const existing = await db
    .select({ month: monthlySales.month })
    .from(monthlySales)
    .where(eq(monthlySales.id, id));
  await db.delete(monthlySales).where(eq(monthlySales.id, id)).execute();

  if (existing[0]?.month) {
    await syncGoalEarnedForMonth(existing[0].month);
  }
}
