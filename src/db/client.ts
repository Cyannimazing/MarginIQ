import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

const expoDb = openDatabaseSync('marginiq.db');

function ensureColumn(table: string, column: string, type: string, defaultValue?: string) {
  try {
    const info = expoDb.getAllSync(`PRAGMA table_info(${table})`) as any[];
    const exists = info.some((col) => col.name === column);
    if (!exists) {
      const def = defaultValue !== undefined ? ` DEFAULT ${defaultValue}` : '';
      expoDb.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${def};`);
    }
  } catch (error) {
    console.error(`Migration error on ${table}.${column}:`, error);
  }
}

function runMigrationStatement(statement: string) {
  try {
    expoDb.execSync(statement);
  } catch (error) {
    // Suppress for IF NOT EXISTS
  }
}

// Initial Tables
runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_per_unit REAL NOT NULL DEFAULT 0,
    yield_factor REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Safe migration: rebuild ingredients table without the old `category` column
// (ALTER TABLE DROP COLUMN is unsupported on older SQLite/Android versions)
try {
  const cols = expoDb.getAllSync(`PRAGMA table_info(ingredients)`) as any[];
  const hasCategory = cols.some((c) => c.name === 'category');
  const hasQuantity = cols.some((c) => c.name === 'quantity');
  if (hasCategory && !hasQuantity) {
    // Rebuild table without category to fix NOT NULL constraint
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS ingredients_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        price_per_unit REAL NOT NULL DEFAULT 0,
        yield_factor REAL NOT NULL DEFAULT 1,
        classification TEXT NOT NULL DEFAULT 'measurable',
        product_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
    `);
    expoDb.execSync(`
      INSERT INTO ingredients_new (id, name, unit, price_per_unit, yield_factor, product_id, created_at, updated_at)
      SELECT id, name, unit, price_per_unit, yield_factor, COALESCE(product_id, 0), COALESCE(created_at, ''), COALESCE(updated_at, '')
      FROM ingredients;
    `);
    expoDb.execSync(`DROP TABLE ingredients;`);
    expoDb.execSync(`ALTER TABLE ingredients_new RENAME TO ingredients;`);
  }
} catch (e) {
  console.error('Migration rebuild error:', e);
}

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    batch_size INTEGER NOT NULL DEFAULT 1,
    target_margin REAL NOT NULL DEFAULT 0.5,
    selling_price REAL NOT NULL DEFAULT 0,
    vat_percent REAL NOT NULL DEFAULT 0.12,
    created_at TEXT NOT NULL
  );
`);

// Add Missing Columns safely to Ingredients
ensureColumn('ingredients', 'yield_factor', 'REAL', '1');
ensureColumn('ingredients', 'created_at', 'TEXT', "''");
ensureColumn('ingredients', 'updated_at', 'TEXT', "''");
ensureColumn('ingredients', 'product_id', 'INTEGER', '0');
ensureColumn('ingredients', 'quantity', 'REAL', '1');
ensureColumn('ingredients', 'classification', 'TEXT');

// Add Missing Columns safely to Products
ensureColumn('products', 'batch_size', 'INTEGER', '1');
ensureColumn('products', 'target_margin', 'REAL', '0.5');
ensureColumn('products', 'selling_price', 'REAL', '0');
ensureColumn('products', 'vat_percent', 'REAL', '0.12');
ensureColumn('products', 'created_at', 'TEXT', "''");
ensureColumn('products', 'pricing_method', 'TEXT', "'margin'");
ensureColumn('products', 'monthly_goal_profit', 'REAL', '0');
ensureColumn('products', 'base_cost', 'REAL', '0');
ensureColumn('products', 'is_pinned', 'INTEGER', '0');
ensureColumn('products', 'color', 'TEXT', "''");
ensureColumn('products', 'is_archived', 'INTEGER', '0');
ensureColumn('products', 'updated_at', 'TEXT', "''");
ensureColumn('products', 'deleted_at', 'TEXT', 'NULL');

// Ensure other tables
runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS product_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    product_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity_used REAL NOT NULL,
    cost_type TEXT NOT NULL DEFAULT 'material'
  );
`);
ensureColumn('product_ingredients', 'cost_type', 'TEXT', "'material'");

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    rate_type TEXT NOT NULL
  );
`);

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS product_labor (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    product_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    minutes REAL NOT NULL,
    labor_cost REAL NOT NULL DEFAULT 0
  );
`);

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS monthly_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    product_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    units_sold_discounted INTEGER NOT NULL DEFAULT 0,
    units_unsold INTEGER NOT NULL DEFAULT 0,
    actual_revenue REAL NOT NULL DEFAULT 0,
    actual_cost REAL NOT NULL DEFAULT 0,
    actual_profit REAL NOT NULL DEFAULT 0,
    target_profit REAL NOT NULL DEFAULT 0,
    shortfall REAL NOT NULL DEFAULT 0,
    recorded_at TEXT NOT NULL
  );
`);
ensureColumn('monthly_sales', 'units_sold_discounted', 'INTEGER', '0');
ensureColumn('monthly_sales', 'units_unsold', 'INTEGER', '0');
ensureColumn('monthly_sales', 'actual_profit', 'REAL', '0');
ensureColumn('monthly_sales', 'target_profit', 'REAL', '0');
ensureColumn('monthly_sales', 'shortfall', 'REAL', '0');

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS monthly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    month TEXT NOT NULL,
    target_profit REAL NOT NULL DEFAULT 0,
    earned_so_far REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
`);
ensureColumn('monthly_goals', 'earned_so_far', 'REAL', '0');
ensureColumn('monthly_goals', 'updated_at', 'TEXT', "''");

runMigrationStatement(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

runMigrationStatement(`DROP INDEX IF EXISTS idx_monthly_sales_product_month;`);
runMigrationStatement(`CREATE INDEX IF NOT EXISTS idx_monthly_sales_product_month ON monthly_sales (product_id, month);`);
runMigrationStatement(`CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_goals_month ON monthly_goals (month);`);

export const db = drizzle(expoDb);
