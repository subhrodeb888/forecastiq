import { db } from "@/db";
import {
  batches,
  categories,
  forecastRuns,
  products,
  saleItems,
  sales,
} from "@/db/schema";
import { formatMonthUTC } from "@/lib/format";
import {
  reportQueryOptionsSchema,
  type ReportQueryOptionsInput,
} from "@/lib/validations/reports";

import {
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";

import type {
  CategoryProfit,
  LowStockProduct,
  MonthlySalesRow,
  ReportsKpis,
  RevenueChartPoint,
  SlowMovingProduct,
  TopSellingProduct,
} from "./types";

/** Month-bucket expression shared by every monthly report — defined once. */
const monthBucket = sql<string>`date_trunc('month', ${sales.saleDate})::date`;

/** First day (UTC midnight) of the month `offset` months before this one. */
function monthStartUTC(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
}

/**
 * Headline KPIs for the reports dashboard: four single-aggregate queries run
 * in parallel over the pooled connection. `sum` returns null on an empty
 * ledger, so revenue falls back to zero.
 */
export async function getReportsKpis(): Promise<ReportsKpis> {
  const [revenue, totalSales, totalProducts, totalForecasts] = await Promise.all([
    db.select({ value: sum(sales.totalAmount) }).from(sales),
    db.select({ value: count() }).from(sales),
    db.select({ value: count() }).from(products),
    db.select({ value: count() }).from(forecastRuns),
  ]);

  return {
    totalRevenue: Number(revenue[0]?.value ?? 0),
    totalSales: totalSales[0]?.value ?? 0,
    totalProducts: totalProducts[0]?.value ?? 0,
    totalForecasts: totalForecasts[0]?.value ?? 0,
  };
}

/**
 * Monthly sales performance — orders, revenue, and average order value for
 * the trailing `months` calendar months, newest month first. This single
 * grouped query backs both the revenue chart (via `buildRevenueChartData`)
 * and the monthly sales table, so the bucketing SQL exists exactly once.
 */
export async function getMonthlySalesSummary(
  options: ReportQueryOptionsInput = {},
): Promise<MonthlySalesRow[]> {
  const { months } = reportQueryOptionsSchema.parse(options);

  const rows = await db
    .select({
      month: monthBucket,
      totalOrders: count(),
      revenue: sum(sales.totalAmount),
      avgOrderValue: avg(sales.totalAmount),
    })
    .from(sales)
    .where(gte(sales.saleDate, monthStartUTC(months - 1)))
    .groupBy(monthBucket)
    .orderBy(desc(monthBucket));

  return rows.map((row) => ({
    month: new Date(`${row.month}T00:00:00.000Z`),
    totalOrders: row.totalOrders,
    revenue: Number(row.revenue ?? 0),
    avgOrderValue: Number(row.avgOrderValue ?? 0),
  }));
}

/**
 * Zero-fills a monthly sales summary into a complete oldest-first revenue
 * series with preformatted labels, so months without sales still appear on
 * the chart instead of collapsing the line.
 */
export function buildRevenueChartData(
  summary: MonthlySalesRow[],
  months = 12,
): RevenueChartPoint[] {
  const revenueByMonth = new Map(
    summary.map((row) => [
      `${row.month.getUTCFullYear()}-${row.month.getUTCMonth()}`,
      row.revenue,
    ]),
  );

  const points: RevenueChartPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    const month = monthStartUTC(offset);
    points.push({
      month: formatMonthUTC(month),
      revenue:
        revenueByMonth.get(`${month.getUTCFullYear()}-${month.getUTCMonth()}`) ?? 0,
    });
  }
  return points;
}

/**
 * Products ranked by total units sold (revenue breaks ties), computed from
 * the sale_items ledger so revenue reflects the price at the time of sale
 * rather than the product's current price.
 */
export async function getTopSellingProducts(
  options: ReportQueryOptionsInput = {},
): Promise<TopSellingProduct[]> {
  const { limit } = reportQueryOptionsSchema.parse(options);

  const unitsSold = sql<number>`sum(${saleItems.quantity})`;
  const revenue = sql<number>`sum(${saleItems.quantity} * ${saleItems.sellingPrice})`;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      unitsSold,
      revenue,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .groupBy(products.id, products.name, products.sku)
    .orderBy(desc(unitsSold), desc(revenue), asc(products.name))
    .limit(limit);

  // Decimal aggregates arrive as strings from the driver — normalize once here.
  return rows.map((row) => ({
    ...row,
    unitsSold: Number(row.unitsSold ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
}

/**
 * Products at or below their reorder level, lowest stock first — the restock
 * priority list.
 */
export async function getLowStockProducts(): Promise<LowStockProduct[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      currentStock: products.currentStock,
      reorderLevel: products.reorderLevel,
    })
    .from(products)
    .where(lte(products.currentStock, products.reorderLevel))
    .orderBy(asc(products.currentStock), asc(products.name));
}

/**
 * Profitability per category, computed from the sale ledger so revenue
 * reflects the price at the time of sale. The unit cost of each sold item is
 * its batch's purchase price; sale rows without a batch fall back to the
 * product's average batch cost, then to zero when the product has no batches
 * at all. Categories are ordered by revenue, biggest first.
 */
export async function getProfitByCategory(): Promise<CategoryProfit[]> {
  // Per-product average batch cost — fallback unit cost for unbatched sales.
  const avgBatchCost = db
    .select({
      productId: batches.productId,
      avgCost: sql<number>`avg(${batches.purchasePrice})`,
    })
    .from(batches)
    .groupBy(batches.productId)
    .as("avg_batch_cost");

  const unitCost = sql<number>`coalesce(${batches.purchasePrice}, ${avgBatchCost.avgCost}, 0)`;
  const revenue = sql<number>`sum(${saleItems.quantity} * ${saleItems.sellingPrice})`;
  const cost = sql<number>`sum(${saleItems.quantity} * ${unitCost})`;

  const rows = await db
    .select({
      categoryName: categories.name,
      revenue,
      cost,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(batches, eq(saleItems.batchId, batches.id))
    .leftJoin(avgBatchCost, eq(products.id, avgBatchCost.productId))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(revenue));

  // Decimal aggregates arrive as strings from the driver — normalize once here.
  return rows.map((row) => {
    const totalRevenue = Number(row.revenue ?? 0);
    const totalCost = Number(row.cost ?? 0);
    const profit = totalRevenue - totalCost;

    return {
      categoryName: row.categoryName ?? "Uncategorized",
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      marginPercent:
        totalRevenue > 0
          ? Math.round((profit / totalRevenue) * 1000) / 10
          : 0,
    };
  });
}

/**
 * Products with no recorded sale in the last `days` days (default 90) — the
 * slow-mover report. Never-sold products are included (lastSaleDate null)
 * and rank worst in the days-since-sale ordering.
 */
export async function getSlowMovingProducts(
  days = 90,
): Promise<SlowMovingProduct[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Most recent sale per product — absent when the product has never sold.
  const lastSale = db
    .select({
      productId: saleItems.productId,
      lastSaleDate: sql<Date | null>`max(${sales.saleDate})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .groupBy(saleItems.productId)
    .as("last_sale");

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      currentStock: products.currentStock,
      lastSaleDate: lastSale.lastSaleDate,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(lastSale, eq(products.id, lastSale.productId))
    .where(or(isNull(lastSale.lastSaleDate), lt(lastSale.lastSaleDate, cutoff)));

  const now = Date.now();

  // Worst first: largest days-since-sale, never-sold (null) ahead of everything.
  return rows
    .map((row) => {
      // Aggregate timestamps from a subquery bypass the driver's column
      // typing — normalize before date math (may arrive as a string).
      const lastSaleDate = row.lastSaleDate as Date | string | null;
      const lastSaleAt = lastSaleDate ? new Date(lastSaleDate).getTime() : null;

      return {
        ...row,
        lastSaleDate: lastSaleAt === null ? null : new Date(lastSaleAt),
        daysSinceSale:
          lastSaleAt === null
            ? null
            : Math.floor((now - lastSaleAt) / (1000 * 60 * 60 * 24)),
      };
    })
    .sort(
      (a, b) =>
        (b.daysSinceSale ?? Number.POSITIVE_INFINITY) -
          (a.daysSinceSale ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name),
    );
}
