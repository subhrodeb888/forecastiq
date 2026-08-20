import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ─── Auth ─── */
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    unique("account_provider_providerAccountId").on(
      account.provider,
      account.providerAccountId,
    ),
  ],
);

/* ─── Categories ─── */
export const categories = pgTable("categories", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull().unique(),
  description: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

/* ─── Suppliers ─── */
export const suppliers = pgTable("suppliers", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  contactPerson: varchar({ length: 255 }),
  email: varchar({ length: 255 }),
  phone: varchar({ length: 50 }),
  address: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

/* ─── Products (added safetyStock) ─── */
export const products = pgTable("products", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  sku: varchar({ length: 100 }).notNull().unique(),
  manufacturer: varchar({ length: 255 }),
  categoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
  sellingPrice: decimal({ precision: 10, scale: 2 }).notNull(),
  currentStock: integer().notNull().default(0),
  reorderLevel: integer().notNull().default(0),
  safetyStock: integer().notNull().default(0),
  createdAt: timestamp().defaultNow().notNull(),
});

/* ─── Batches (NEW) ─── */
export const batches = pgTable(
  "batches",
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchNumber: varchar({ length: 100 }).notNull(),
    quantity: integer().notNull(),
    purchasePrice: decimal({ precision: 10, scale: 2 }).notNull(),
    expiryDate: timestamp().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("batches_product_idx").on(t.productId),
    index("batches_expiry_idx").on(t.expiryDate),
  ],
);

/* ─── Purchases (added status, deliveryDate, notes) ─── */
export const purchases = pgTable("purchases", {
  id: uuid().defaultRandom().primaryKey(),
  supplierId: uuid().references(() => suppliers.id, { onDelete: "set null" }),
  status: varchar({ length: 20 }).notNull().default("draft"),
  purchaseDate: timestamp().notNull().defaultNow(),
  deliveryDate: timestamp(),
  totalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
  notes: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid().defaultRandom().primaryKey(),
  purchaseId: uuid()
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer().notNull(),
  purchasePrice: decimal({ precision: 10, scale: 2 }).notNull(),
});

/* ─── Sales (added index) ─── */
export const sales = pgTable(
  "sales",
  {
    id: uuid().defaultRandom().primaryKey(),
    saleDate: timestamp().notNull().defaultNow(),
    totalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
    notes: text(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("sales_date_idx").on(t.saleDate)],
);

export const saleItems = pgTable("sale_items", {
  id: uuid().defaultRandom().primaryKey(),
  saleId: uuid()
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer().notNull(),
  sellingPrice: decimal({ precision: 10, scale: 2 }).notNull(),
  batchId: uuid().references(() => batches.id, { onDelete: "set null" }),
});

/* ─── Stock Movements (NEW) ─── */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchId: uuid().references(() => batches.id, { onDelete: "set null" }),
    type: varchar({ length: 20 }).notNull(),
    quantity: integer().notNull(),
    referenceId: uuid(),
    notes: text(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("movements_product_idx").on(t.productId),
    index("movements_batch_idx").on(t.batchId),
    index("movements_type_idx").on(t.type),
  ],
);

/* ─── Forecasts (added userId to runs, index on dates) ─── */
export const forecastRuns = pgTable("forecast_runs", {
  id: uuid().defaultRandom().primaryKey(),
  productId: uuid()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: text().references(() => users.id, { onDelete: "set null" }),
  model: varchar({ length: 50 }).notNull(),
  horizonDays: integer().notNull(),
  confidenceScore: varchar({ length: 10 }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const forecasts = pgTable(
  "forecasts",
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    runId: uuid().references(() => forecastRuns.id, { onDelete: "cascade" }),
    forecastDate: timestamp().notNull(),
    predictedDemand: decimal({ precision: 10, scale: 2 }).notNull(),
    lowerBound: decimal({ precision: 10, scale: 2 }),
    upperBound: decimal({ precision: 10, scale: 2 }),
    confidenceScore: varchar({ length: 10 }).notNull(),
  },
  (t) => [
    index("forecasts_date_idx").on(t.forecastDate),
    // saveForecastRun() upserts one row per (product, date) via
    // onConflictDoUpdate — keep this unique index in sync with migration 0000
    // ("forecasts_product_date_unique") so a future db:generate does not drop it.
    uniqueIndex("forecasts_product_date_unique").on(t.productId, t.forecastDate),
  ],
);

/* ─── Relations ─── */
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  batches: many(batches),
  purchaseItems: many(purchaseItems),
  saleItems: many(saleItems),
  forecastRuns: many(forecastRuns),
  forecasts: many(forecasts),
  stockMovements: many(stockMovements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseItems),
  stockMovements: many(stockMovements),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  items: many(saleItems),
  stockMovements: many(stockMovements),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  batch: one(batches, {
    fields: [saleItems.batchId],
    references: [batches.id],
  }),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  batch: one(batches, {
    fields: [stockMovements.batchId],
    references: [batches.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

export const forecastRunsRelations = relations(
  forecastRuns,
  ({ one, many }) => ({
    product: one(products, {
      fields: [forecastRuns.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [forecastRuns.userId],
      references: [users.id],
    }),
    forecasts: many(forecasts),
  }),
);

export const forecastsRelations = relations(forecasts, ({ one }) => ({
  product: one(products, {
    fields: [forecasts.productId],
    references: [products.id],
  }),
  run: one(forecastRuns, {
    fields: [forecasts.runId],
    references: [forecastRuns.id],
  }),
}));
