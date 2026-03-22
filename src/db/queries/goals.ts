import { desc, eq, sql } from 'drizzle-orm';
import { MonthlyGoalInput } from '../../features/goals/types';
import { db } from '../client';
import { monthlyGoals, monthlySales } from '../schema';

const getTimestamp = () => new Date().toISOString();

async function getEarnedSoFarForMonth(month: string) {
  const rows = await db
    .select({
      earnedSoFar: sql<number>`COALESCE(SUM(${monthlySales.actualProfit}), 0)`,
    })
    .from(monthlySales)
    .where(eq(monthlySales.month, month));

  const value = Number(rows[0]?.earnedSoFar ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function listMonthlyGoals() {
  return db
    .select()
    .from(monthlyGoals)
    .orderBy(desc(monthlyGoals.month), desc(monthlyGoals.updatedAt));
}

export async function upsertMonthlyGoal(input: MonthlyGoalInput) {
  const month = input.month.trim();
  const targetProfit = Number.isFinite(input.targetProfit) ? Math.max(0, input.targetProfit) : 0;
  const existing = await db
    .select({ id: monthlyGoals.id })
    .from(monthlyGoals)
    .where(eq(monthlyGoals.month, month));

  const earnedSoFar = await getEarnedSoFarForMonth(month);
  const now = getTimestamp();

  if (existing[0]) {
    await db
      .update(monthlyGoals)
      .set({
        targetProfit,
        earnedSoFar,
        updatedAt: now,
      })
      .where(eq(monthlyGoals.id, existing[0].id))
      .execute();
    return;
  }

  await db
    .insert(monthlyGoals)
    .values({
      month,
      targetProfit,
      earnedSoFar,
      updatedAt: now,
    })
    .execute();
}

export async function deleteMonthlyGoal(id: number) {
  await db.delete(monthlyGoals).where(eq(monthlyGoals.id, id)).execute();
}

export async function syncGoalEarnedForMonth(month: string) {
  const targetMonth = month.trim();
  const earnedSoFar = await getEarnedSoFarForMonth(targetMonth);

  await db
    .update(monthlyGoals)
    .set({
      earnedSoFar,
      updatedAt: getTimestamp(),
    })
    .where(eq(monthlyGoals.month, targetMonth))
    .execute();
}

export async function syncAllGoalEarnedValues() {
  const goals = await db.select({ month: monthlyGoals.month }).from(monthlyGoals);
  for (const goal of goals) {
    await syncGoalEarnedForMonth(goal.month);
  }
}

export async function getMonthlyGoalByMonth(month: string) {
  const rows = await db
    .select()
    .from(monthlyGoals)
    .where(eq(monthlyGoals.month, month.trim()));
  return rows[0];
}

export async function hasMonthlyGoal(month: string) {
  const rows = await db
    .select({ id: monthlyGoals.id })
    .from(monthlyGoals)
    .where(eq(monthlyGoals.month, month.trim()));
  return !!rows[0];
}
