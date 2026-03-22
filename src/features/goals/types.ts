import { monthlyGoals } from '../../db/schema';

export type MonthlyGoal = typeof monthlyGoals.$inferSelect;

export type MonthlyGoalInput = {
  month: string;
  targetProfit: number;
};
