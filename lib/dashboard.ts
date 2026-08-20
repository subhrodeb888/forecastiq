import { db } from "@/db";
import { products, suppliers, sales } from "@/db/schema";

import { count, sum } from "drizzle-orm";

export async function getDashboardStats() {
  const [productCount, supplierCount, salesCount, revenue] = await Promise.all([
    db.select({ value: count() }).from(products),

    db.select({ value: count() }).from(suppliers),

    db.select({ value: count() }).from(sales),

    db
      .select({
        value: sum(sales.totalAmount),
      })
      .from(sales),
  ]);

  return {
    products: productCount[0].value,

    suppliers: supplierCount[0].value,

    sales: salesCount[0].value,

    revenue: Number(revenue[0].value ?? 0),
  };
}
