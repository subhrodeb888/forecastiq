import { db } from "@/db";
import {
  products,
  batches,
  purchaseItems,
  purchases,
  forecastRuns,
  forecasts,
  saleItems,
  sales,
} from "@/db/schema";
import { eq, desc, sql, gte, inArray } from "drizzle-orm";
import type { ReorderRecommendation } from "./types";

const PENDING_PO_STATUSES = ["ordered", "partially_received"] as const;

/**
 * Calculate reorder recommendations for every product:
 *
 *   suggestedQty = predictedDemand + safetyStock - currentStock - incomingStock
 *
 * Predicted demand prefers the latest forecast; falls back to a 30-day
 * sales-rate projection. Only products with netNeed > 0 are returned.
 */
export async function getReorderRecommendations(): Promise<
  ReorderRecommendation[]
> {
  // 1. Current stock per product (from batches)
  const stockRows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      reorderLevel: products.reorderLevel,
      safetyStock: products.safetyStock,
      currentStock: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
    })
    .from(products)
    .leftJoin(batches, eq(products.id, batches.productId))
    .groupBy(
      products.id,
      products.name,
      products.sku,
      products.reorderLevel,
      products.safetyStock,
    );

  // 2. Incoming stock from pending purchase orders
  const incomingRows = await db
    .select({
      productId: purchaseItems.productId,
      incomingQuantity: sql<number>`SUM(${purchaseItems.quantity})`,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(inArray(purchases.status, [...PENDING_PO_STATUSES]))
    .groupBy(purchaseItems.productId);

  const incomingMap = new Map(
    incomingRows.map((r) => [r.productId, Number(r.incomingQuantity)]),
  );

  // 3. Latest forecast per product (most recent run)
  const latestRuns = await db
    .selectDistinctOn([forecastRuns.productId], {
      productId: forecastRuns.productId,
      runId: forecastRuns.id,
    })
    .from(forecastRuns)
    .orderBy(forecastRuns.productId, desc(forecastRuns.createdAt));

  const forecastMap = new Map<string, number>();
  if (latestRuns.length > 0) {
    const runIds = latestRuns.map((r) => r.runId);
    const forecastRows = await db
      .select({
        runId: forecasts.runId,
        predictedDemand: sql<number>`SUM(${forecasts.predictedDemand})`,
      })
      .from(forecasts)
      .where(inArray(forecasts.runId, runIds))
      .groupBy(forecasts.runId);

    const demandByRun = new Map(
      forecastRows.map((r) => [r.runId, Number(r.predictedDemand)]),
    );
    for (const run of latestRuns) {
      const demand = demandByRun.get(run.runId);
      if (demand !== undefined) {
        forecastMap.set(run.productId, demand);
      }
    }
  }

  // 4. Fallback: total sales in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const salesRows = await db
    .select({
      productId: saleItems.productId,
      totalSold: sql<number>`SUM(${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.saleDate, thirtyDaysAgo))
    .groupBy(saleItems.productId);

  const salesMap = new Map(
    salesRows.map((r) => [r.productId, Number(r.totalSold)]),
  );

  // 5. Build recommendations
  const recommendations: ReorderRecommendation[] = [];

  for (const p of stockRows) {
    const currentStock = Number(p.currentStock);
    const incomingStock = incomingMap.get(p.productId) ?? 0;
    const forecastDemand = forecastMap.get(p.productId);
    const recentSales = salesMap.get(p.productId) ?? 0;

    // Prefer forecast; fallback to 30-day sales rate projected forward 30 days
    const predictedDemand =
      forecastDemand ?? Math.ceil((recentSales / 30) * 30);

    const netNeed =
      predictedDemand + p.safetyStock - currentStock - incomingStock;

    if (netNeed > 0) {
      const urgency: ReorderRecommendation["urgency"] =
        currentStock === 0
          ? "critical"
          : currentStock <= p.reorderLevel
            ? "high"
            : currentStock <= p.reorderLevel + p.safetyStock
              ? "medium"
              : "low";

      const incomingText =
        incomingStock > 0 ? ` and ${incomingStock} incoming` : "";

      recommendations.push({
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        currentStock,
        incomingStock,
        predictedDemand,
        safetyStock: p.safetyStock,
        reorderLevel: p.reorderLevel,
        suggestedQuantity: Math.ceil(netNeed),
        reason: forecastDemand
          ? `Forecast predicts ${predictedDemand} units needed. You have ${currentStock} in stock${incomingText}.`
          : `Recent sales rate is ${recentSales} units/30 days. You have ${currentStock} in stock${incomingText}.`,
        urgency,
      });
    }
  }

  // Sort: critical first, then by suggested quantity desc
  const rank: Record<ReorderRecommendation["urgency"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  recommendations.sort(
    (a, b) =>
      rank[a.urgency] - rank[b.urgency] ||
      b.suggestedQuantity - a.suggestedQuantity,
  );

  return recommendations;
}

/** Single-product reorder check (for product detail page). */
export async function getProductReorderStatus(productId: string) {
  const recs = await getReorderRecommendations();
  return recs.find((r) => r.productId === productId) ?? null;
}
