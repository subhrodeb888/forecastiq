import { db } from "@/db";
import { purchases, suppliers } from "@/db/schema";
import type { PurchaseStatus } from "@/features/purchases/types";
import { formatCurrency } from "@/lib/format";
import {
  PAGE_SIZE,
  getTotalPages,
  type PaginatedResult,
} from "@/lib/pagination";

import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type {
  Supplier,
  SupplierListItem,
  SupplierOption,
  SupplierRecentOrder,
} from "./types";

/** All suppliers, alphabetically — options for select dropdowns. */
export async function listSupplierOptions(): Promise<SupplierOption[]> {
  return db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
}

/**
 * One page of suppliers with procurement stats, alphabetically. Cancelled
 * orders are excluded via the JOIN condition so a supplier with only
 * cancelled orders still shows zeros — the same convention as
 * getSupplierSummary, keeping list and detail stats in agreement. The count
 * is taken first so an out-of-range ?page= clamps to the last real page
 * instead of returning an empty slice.
 */
export async function getSuppliers(
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<PaginatedResult<SupplierListItem>> {
  const countRows = await db.select({ value: count() }).from(suppliers);
  const totalCount = countRows[0]?.value ?? 0;
  const safePage = Math.min(
    Math.max(1, page),
    getTotalPages(totalCount, pageSize),
  );

  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactPerson: suppliers.contactPerson,
      email: suppliers.email,
      phone: suppliers.phone,
      totalOrders: count(purchases.id),
      totalSpend: sql<number>`coalesce(sum(${purchases.totalAmount}), 0)`,
      averageDeliveryDays: sql<
        number | null
      >`avg(extract(epoch from (${purchases.deliveryDate} - ${purchases.purchaseDate})) / 86400)`,
    })
    .from(suppliers)
    .leftJoin(
      purchases,
      and(
        eq(purchases.supplierId, suppliers.id),
        ne(purchases.status, "cancelled"),
      ),
    )
    .groupBy(
      suppliers.id,
      suppliers.name,
      suppliers.contactPerson,
      suppliers.email,
      suppliers.phone,
    )
    .orderBy(asc(suppliers.name))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  // Decimal aggregates arrive as strings from the driver — normalize once here.
  const items = rows.map((row) => {
    const totalSpend = Number(row.totalSpend);
    return {
      ...row,
      totalSpend,
      totalSpendLabel: formatCurrency(totalSpend),
      averageDeliveryDays:
        row.averageDeliveryDays === null
          ? null
          : Math.round(Number(row.averageDeliveryDays) * 10) / 10,
    };
  });

  return { items, totalCount };
}

/** Single supplier record, or null when the id is unknown. */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Orders on their way from this supplier — placed but not fully received. */
export async function getActivePurchaseOrderCount(
  supplierId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(purchases)
    .where(
      and(
        eq(purchases.supplierId, supplierId),
        inArray(purchases.status, ["ordered", "partially_received"]),
      ),
    );
  return rows[0]?.value ?? 0;
}

/** The supplier's most recent purchase orders (any status), newest first. */
export async function getRecentPurchaseOrders(
  supplierId: string,
  limit = 10,
): Promise<SupplierRecentOrder[]> {
  const rows = await db
    .select({
      id: purchases.id,
      status: purchases.status,
      purchaseDate: purchases.purchaseDate,
      totalAmount: purchases.totalAmount,
    })
    .from(purchases)
    .where(eq(purchases.supplierId, supplierId))
    .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const totalAmount = Number(row.totalAmount);
    return {
      ...row,
      status: row.status as PurchaseStatus,
      totalAmount,
      totalAmountLabel: formatCurrency(totalAmount),
    };
  });
}
