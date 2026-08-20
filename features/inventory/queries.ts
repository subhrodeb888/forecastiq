import { db } from "@/db";
import {
  batches,
  products,
  stockMovements,
  users,
} from "@/db/schema";
import { eq, and, gte, lte, desc, asc, sql, count } from "drizzle-orm";
import type {
  Batch,
  StockMovementWithDetails,
  InventorySummary,
  ExpiryAlert,
} from "./types";

/** All batches for a product, oldest expiry first (FEFO order). */
export async function getProductBatches(productId: string): Promise<Batch[]> {
  const rows = await db
    .select({
      id: batches.id,
      productId: batches.productId,
      batchNumber: batches.batchNumber,
      quantity: batches.quantity,
      purchasePrice: batches.purchasePrice,
      expiryDate: batches.expiryDate,
      createdAt: batches.createdAt,
    })
    .from(batches)
    .where(eq(batches.productId, productId))
    .orderBy(asc(batches.expiryDate), asc(batches.createdAt));

  // purchasePrice is a decimal column — the driver returns it as a string.
  return rows.map((row) => ({ ...row, purchasePrice: Number(row.purchasePrice) }));
}

/** Movement columns shared by every stock-movement query (product/batch/user resolved). */
const stockMovementColumns = {
  id: stockMovements.id,
  productId: stockMovements.productId,
  batchId: stockMovements.batchId,
  type: stockMovements.type,
  quantity: stockMovements.quantity,
  referenceId: stockMovements.referenceId,
  notes: stockMovements.notes,
  userId: stockMovements.userId,
  createdAt: stockMovements.createdAt,
  productName: products.name,
  batchNumber: batches.batchNumber,
  userName: users.name,
};

/** Stock movement audit trail for a product, newest first. */
export async function getStockMovements(
  productId: string,
  limit = 50
): Promise<StockMovementWithDetails[]> {
  const rows = await db
    .select(stockMovementColumns)
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(batches, eq(stockMovements.batchId, batches.id))
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    // The varchar column arrives as a plain string — narrow to the union.
    type: r.type as StockMovementWithDetails["type"],
    userName: r.userName ?? "System",
    batchNumber: r.batchNumber ?? null,
  }));
}

/** Latest stock movements across all products, newest first — dashboard activity feed. */
export async function getRecentStockMovements(
  limit = 5
): Promise<StockMovementWithDetails[]> {
  const rows = await db
    .select(stockMovementColumns)
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(batches, eq(stockMovements.batchId, batches.id))
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    // The varchar column arrives as a plain string — narrow to the union.
    type: r.type as StockMovementWithDetails["type"],
    userName: r.userName ?? "System",
    batchNumber: r.batchNumber ?? null,
  }));
}

/** Per-product inventory: total quantity, batch count, nearest expiry. */
export async function getInventorySummary(): Promise<InventorySummary[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      totalQuantity: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
      batchCount: count(batches.id),
      nearestExpiry: sql<Date | null>`MIN(${batches.expiryDate})`,
    })
    .from(products)
    .leftJoin(batches, eq(products.id, batches.productId))
    .groupBy(products.id, products.name, products.sku)
    .orderBy(asc(products.name));

  return rows.map((r) => ({
    ...r,
    totalQuantity: Number(r.totalQuantity),
  }));
}

/** Batches expiring within the next N days. */
export async function getExpiryAlerts(days = 90): Promise<ExpiryAlert[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const rows = await db
    .select({
      batchId: batches.id,
      batchNumber: batches.batchNumber,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      quantity: batches.quantity,
      purchasePrice: batches.purchasePrice,
      expiryDate: batches.expiryDate,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .where(
      and(
        lte(batches.expiryDate, cutoff),
        gte(batches.quantity, 1)
      )
    )
    .orderBy(asc(batches.expiryDate));

  const now = new Date();

  return rows.map((r) => ({
    ...r,
    // purchasePrice is a decimal column — the driver returns it as a string.
    purchasePrice: Number(r.purchasePrice),
    daysUntilExpiry: Math.ceil(
      (r.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

/** Products where total batch quantity <= reorderLevel + safetyStock. */
export async function getLowStockProducts() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      reorderLevel: products.reorderLevel,
      safetyStock: products.safetyStock,
      totalQuantity: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
    })
    .from(products)
    .leftJoin(batches, eq(products.id, batches.productId))
    .groupBy(products.id, products.name, products.sku, products.reorderLevel, products.safetyStock)
    .having(
      sql`COALESCE(SUM(${batches.quantity}), 0) <= ${products.reorderLevel} + ${products.safetyStock}`
    )
    .orderBy(asc(sql`COALESCE(SUM(${batches.quantity}), 0)`));

  return rows.map((r) => ({
    ...r,
    totalQuantity: Number(r.totalQuantity),
  }));
}

/** Single batch lookup. */
export async function getBatchById(batchId: string) {
  const rows = await db
    .select()
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  return rows[0] ?? null;
}