import { db } from "@/db";
import { products, saleItems, sales } from "@/db/schema";
import { formatCurrency } from "@/lib/format";

import { asc, count, desc, eq, gte, sql } from "drizzle-orm";

import type { SaleListItem, SaleProductOption, TodaysSalesSummary } from "./types";

/** All products, alphabetically — options for the sale form's product select. */
export async function listSaleProducts(): Promise<SaleProductOption[]> {
  return db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .orderBy(asc(products.name));
}

/** Recent sales with line-item counts, newest first. */
export async function getRecentSales(limit = 50): Promise<SaleListItem[]> {
  const rows = await db
    .select({
      id: sales.id,
      saleDate: sales.saleDate,
      totalAmount: sales.totalAmount,
      itemCount: count(saleItems.id),
    })
    .from(sales)
    .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
    .groupBy(sales.id, sales.saleDate, sales.totalAmount)
    .orderBy(desc(sales.saleDate), desc(sales.createdAt))
    .limit(limit);

  // The decimal total arrives as a string from the driver — normalize once here.
  return rows.map((row) => {
    const totalAmount = Number(row.totalAmount);
    return {
      ...row,
      totalAmount,
      totalAmountLabel: formatCurrency(totalAmount),
    };
  });
}

/** Revenue and order count since midnight (server local time) — dashboard KPI. */
export async function getTodaysSalesSummary(): Promise<TodaysSalesSummary> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      totalRevenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`,
      salesCount: count(),
    })
    .from(sales)
    .where(gte(sales.saleDate, startOfToday));

  // The decimal aggregate arrives as a string from the driver — normalize once here.
  return {
    totalRevenue: Number(rows[0]?.totalRevenue ?? 0),
    salesCount: rows[0]?.salesCount ?? 0,
  };
}
