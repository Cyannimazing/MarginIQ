import { monthlySales } from '../../db/schema';

export type MonthlySale = typeof monthlySales.$inferSelect;

export type MonthlySaleInput = {
  productId: number;
  month: string;
  unitsSold: number;
  unitsUnsold: number;
  actualRevenue: number;
  actualCost: number;
  actualProfit: number;
  targetProfit: number;
  shortfall: number;
};
