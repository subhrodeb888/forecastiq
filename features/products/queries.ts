import { db } from "@/db";
import { categories, products } from "@/db/schema";
import {
  PAGE_SIZE,
  getTotalPages,
  type PaginatedResult,
} from "@/lib/pagination";

import { asc, count, eq } from "drizzle-orm";

import type { ProductListItem } from "./types";

/**
 * One page of the product catalog, alphabetical by name — a stable order so
 * offset pagination never shifts rows between pages. The count is taken
 * first so an out-of-range ?page= clamps to the last real page instead of
 * returning an empty slice.
 */
export async function getProducts(
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<PaginatedResult<ProductListItem>> {
  const countRows = await db.select({ value: count() }).from(products);
  const totalCount = countRows[0]?.value ?? 0;
  const safePage = Math.min(
    Math.max(1, page),
    getTotalPages(totalCount, pageSize),
  );

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      manufacturer: products.manufacturer,
      sellingPrice: products.sellingPrice,
      currentStock: products.currentStock,
      reorderLevel: products.reorderLevel,
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  return { items: rows, totalCount };
}
