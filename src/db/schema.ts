import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const ingredients = sqliteTable('ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().default(0),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  quantity: real('quantity').notNull().default(1),
  pricePerUnit: real('price_per_unit').notNull(),
  yieldFactor: real('yield_factor').notNull().default(1),
  classification: text('classification', { enum: ['measurable', 'fixed'] }).notNull().default('measurable'),
  tag: text('tag').notNull().default('Other'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const productCostGroups = sqliteTable('product_cost_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  monthlySharedCost: real('monthly_shared_cost').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  costGroupId: integer('cost_group_id'),
  batchSize: integer('batch_size').notNull().default(1),
  baseCost: real('base_cost').notNull().default(0),
  targetMargin: real('target_margin').notNull().default(0.5),
  sellingPrice: real('selling_price').notNull().default(0),
  vatPercent: real('vat_percent').notNull().default(0),
  pricingMethod: text('pricing_method').notNull().default('margin'),
  monthlyGoalProfit: real('monthly_goal_profit').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0.20),
  monthlyOverhead: real('monthly_overhead').notNull().default(0),
  monthlyProductionQty: real('monthly_production_qty').notNull().default(0),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  color: text('color').notNull().default(''),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
  deletedAt: text('deleted_at'), // ISO timestamp if in trash, null otherwise
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull(),
});

export const productIngredients = sqliteTable('product_ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  ingredientId: integer('ingredient_id').notNull(),
  quantityUsed: real('quantity_used').notNull(),
  costType: text('cost_type', {
    enum: ['ingredients', 'material', 'packaging', 'overhead', 'labor', 'utilities', 'other'],
  }).notNull(),
});

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  rate: real('rate').notNull(),
  rateType: text('rate_type', { enum: ['hourly', 'daily', 'fixed'] }).notNull(),
});

export const productLabor = sqliteTable('product_labor', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  employeeId: integer('employee_id').notNull(),
  minutes: real('minutes').notNull(),
  laborCost: real('labor_cost').notNull().default(0),
});

export const monthlySales = sqliteTable('monthly_sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  month: text('month').notNull(),
  unitsSold: integer('units_sold').notNull().default(0),
  unitsSoldDiscounted: integer('units_sold_discounted').notNull().default(0),
  unitsUnsold: integer('units_unsold').notNull().default(0),
  actualRevenue: real('actual_revenue').notNull().default(0),
  actualCost: real('actual_cost').notNull().default(0),
  actualProfit: real('actual_profit').notNull().default(0),
  targetProfit: real('target_profit').notNull().default(0),
  shortfall: real('shortfall').notNull().default(0),
  recordedAt: text('recorded_at').notNull(),
});
export const monthlyGoals = sqliteTable('monthly_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  month: text('month').notNull(),
  targetProfit: real('target_profit').notNull().default(0),
  earnedSoFar: real('earned_so_far').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
