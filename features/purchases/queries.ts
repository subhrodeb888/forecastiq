import { db } from "@/db";
import { products, purchaseItems, purchases, suppliers } from "@/db/schema";
import { toPaise } from "@/features/inventory/money";
import { formatCurrency } from "@/lib/format";
import {
  PAGE_SIZE,
  getTotalPages,
  type PaginatedResult,
} from "@/lib/pagination";

import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  PENDING_PURCHASE_STATUSES,
  PURCHASE_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderWithItems,
  type PurchaseProductOption,
  type PurchaseStatus,
  type SupplierSummary,
} from "./types";

/** All products, alphabetically — options for the PO form's product picker. */
export async function listProductOptions(): Promise<PurchaseProductOption[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      sellingPrice: products.sellingPrice,
    })
    .from(products)
    .orderBy(asc(products.name));

  // sellingPrice is a decimal column — the driver returns it as a string.
  return rows.map((row) => ({ ...row, sellingPrice: Number(row.sellingPrice) }));
}

/** Header columns shared by every purchase-order query (supplier name resolved). */
const purchaseOrderColumns = {
  id: purchases.id,
  supplierId: purchases.supplierId,
  supplierName: suppliers.name,
  status: purchases.status,
  purchaseDate: purchases.purchaseDate,
  deliveryDate: purchases.deliveryDate,
  totalAmount: purchases.totalAmount,
  notes: purchases.notes,
  createdAt: purchases.createdAt,
};

/**
 * Raw header row as the driver returns it: the varchar status is an
 * unconstrained string and the decimal total arrives as a string.
 */
type PurchaseOrderRow = Omit<
  PurchaseOrder,
  "status" | "totalAmount" | "totalAmountLabel"
> & {
  status: string;
  totalAmount: string;
};

/** Coerce a raw header row into a PurchaseOrder with a display-ready total. */
function toPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  const totalAmount = Number(row.totalAmount);
  return {
    ...row,
    status: row.status as PurchaseStatus,
    totalAmount,
    totalAmountLabel: formatCurrency(totalAmount),
  };
}

/** Shared list query: header rows joined to suppliers, newest order first. */
async function queryPurchaseOrders(
  statuses?: readonly string[],
): Promise<PurchaseOrder[]> {
  const rows = await db
    .select(purchaseOrderColumns)
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(statuses ? inArray(purchases.status, [...statuses]) : undefined)
    .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt));

  return rows.map(toPurchaseOrder);
}

/**
 * One page of purchase orders, newest first. With `statusFilter`, only
 * orders in that status are returned — and counted, so the total reflects
 * the filter; an unrecognized status matches nothing. The count is taken
 * first so an out-of-range ?page= clamps to the last real page instead of
 * returning an empty slice.
 */
export async function getPurchaseOrders(
  statusFilter?: string,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<PaginatedResult<PurchaseOrder>> {
  if (
    statusFilter &&
    !(PURCHASE_STATUSES as readonly string[]).includes(statusFilter)
  ) {
    return { items: [], totalCount: 0 };
  }

  const where = statusFilter
    ? inArray(purchases.status, [statusFilter])
    : undefined;

  const countRows = await db
    .select({ value: count() })
    .from(purchases)
    .where(where);
  const totalCount = countRows[0]?.value ?? 0;
  const safePage = Math.min(
    Math.max(1, page),
    getTotalPages(totalCount, pageSize),
  );

  const rows = await db
    .select(purchaseOrderColumns)
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(where)
    .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  return { items: rows.map(toPurchaseOrder), totalCount };
}

/**
 * Orders still in flight — draft, ordered, or partially received — newest
 * first. Feeds the receiving queue and on-order stock calculations.
 */
export async function getPendingPurchaseOrders(): Promise<PurchaseOrder[]> {
  return queryPurchaseOrders(PENDING_PURCHASE_STATUSES);
}

/**
 * How many orders are still in flight — the dashboard's pending-PO KPI.
 * Counts every pending status, so it can exceed the ?status=ordered list
 * the KPI links to (which excludes drafts and partial receipts).
 */
export async function getPendingPurchaseOrderCount(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(purchases)
    .where(inArray(purchases.status, [...PENDING_PURCHASE_STATUSES]));

  return rows[0]?.value ?? 0;
}

/**
 * A single order with its line items (product name/SKU resolved), or null
 * when the id is unknown. Items come back alphabetically by product name.
 */
export async function getPurchaseOrderById(
  id: string,
): Promise<PurchaseOrderWithItems | null> {
  const orderRows = await db
    .select(purchaseOrderColumns)
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(eq(purchases.id, id))
    .limit(1);

  const order = orderRows[0];
  if (!order) return null;

  const itemRows = await db
    .select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId,
      productId: purchaseItems.productId,
      productName: products.name,
      productSku: products.sku,
      quantity: purchaseItems.quantity,
      purchasePrice: purchaseItems.purchasePrice,
    })
    .from(purchaseItems)
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchaseItems.purchaseId, id))
    .orderBy(asc(products.name));

  const items: PurchaseOrderItem[] = itemRows.map((row) => {
    const purchasePrice = Number(row.purchasePrice);
    // Integer-paise math keeps quantity × unit price exact.
    const lineTotal = (toPaise(purchasePrice) * row.quantity) / 100;

    return {
      ...row,
      purchasePrice,
      purchasePriceLabel: formatCurrency(purchasePrice),
      lineTotal,
      lineTotalLabel: formatCurrency(lineTotal),
    };
  });

  return { ...toPurchaseOrder(order), items };
}

/**
 * Spend and delivery rollup for one supplier. Cancelled orders are excluded —
 * they represent no spend and no delivery — via the JOIN condition so a
 * supplier with only cancelled orders still summarizes as zeros. An unknown
 * supplier id yields a zeroed summary.
 */
export async function getSupplierSummary(
  supplierId: string,
): Promise<SupplierSummary> {
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
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
    .where(eq(suppliers.id, supplierId))
    .groupBy(suppliers.id, suppliers.name);

  const row = rows[0];

  if (!row) {
    return {
      id: supplierId,
      name: "",
      totalOrders: 0,
      totalSpend: 0,
      totalSpendLabel: formatCurrency(0),
      averageDeliveryDays: null,
    };
  }

  const totalSpend = Number(row.totalSpend);
  const averageDeliveryDays =
    row.averageDeliveryDays === null
      ? null
      : Math.round(Number(row.averageDeliveryDays) * 10) / 10;

  return {
    id: row.id,
    name: row.name,
    totalOrders: row.totalOrders,
    totalSpend,
    totalSpendLabel: formatCurrency(totalSpend),
    averageDeliveryDays,
  };
}
