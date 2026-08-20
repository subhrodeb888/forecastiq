"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import { products, saleItems, sales } from "@/db/schema";
import { paiseToMoney, toPaise } from "@/features/inventory/money";
import { parseIndexedItems } from "@/lib/form-data";
import {
  allocateBatchesFEFO,
  commitFEFOAllocation,
  StockContentionError,
  type AllocationResult,
} from "@/lib/inventory";
import { createSaleSchema } from "@/lib/validations/sale";

import { inArray } from "drizzle-orm";

import type { SaleActionResult } from "./types";

/** One merged sale line: the product, its total quantity, and FEFO splits. */
interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  allocations: AllocationResult[];
}

/**
 * Record a sale with FEFO batch allocation. Duplicate product rows are
 * merged first so allocation sees the full per-product quantity. Pricing
 * comes from the catalog, never the client, and each batch allocation gets
 * its own sale_items row — the batch-level traceability pharmacy stock
 * keeping requires. Sale, items, batch deductions and movements all commit
 * in one transaction.
 *
 * Shaped for `useActionState` — insufficient stock, unknown products and
 * stock contention all resolve as structured errors rather than throws.
 */
export async function createSale(
  formData: FormData,
): Promise<SaleActionResult> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to record sales." },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const parsed = createSaleSchema.safeParse({
    items: parseIndexedItems(formData, "items"),
    saleDate: formData.get("saleDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { message: parsed.error.issues[0]?.message ?? "Invalid sale." },
    };
  }

  const quantityByProduct = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  try {
    // Resolve products up front — validates the ids and prices the sale.
    const productRows = await db
      .select({
        id: products.id,
        name: products.name,
        sellingPrice: products.sellingPrice,
      })
      .from(products)
      .where(inArray(products.id, [...quantityByProduct.keys()]));

    const productById = new Map(productRows.map((row) => [row.id, row]));
    if (productById.size !== quantityByProduct.size) {
      return {
        ok: false,
        error: { message: "One or more products are invalid." },
      };
    }

    const lines: SaleLine[] = [];
    for (const [productId, quantity] of quantityByProduct) {
      const product = productById.get(productId)!;

      let allocations: AllocationResult[];
      try {
        allocations = await allocateBatchesFEFO(productId, quantity);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Insufficient stock")
        ) {
          return {
            ok: false,
            error: { message: `${product.name}: ${error.message}` },
          };
        }
        throw error;
      }

      lines.push({
        productId,
        quantity,
        unitPrice: Number(product.sellingPrice),
        allocations,
      });
    }

    // Integer paise — no float drift on money.
    const totalPaise = lines.reduce(
      (sum, line) => sum + line.quantity * toPaise(line.unitPrice),
      0,
    );

    const saleId = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          saleDate: parsed.data.saleDate ?? new Date(),
          totalAmount: paiseToMoney(totalPaise),
          notes: parsed.data.notes || null,
        })
        .returning({ id: sales.id });

      for (const line of lines) {
        await tx.insert(saleItems).values(
          line.allocations.map((alloc) => ({
            saleId: sale.id,
            productId: line.productId,
            quantity: alloc.quantity,
            sellingPrice: paiseToMoney(toPaise(line.unitPrice)),
            batchId: alloc.batchId,
          })),
        );

        await commitFEFOAllocation(
          tx,
          sale.id,
          line.productId,
          line.allocations,
          userId,
        );
      }

      return sale.id;
    });

    for (const productId of quantityByProduct.keys()) {
      revalidatePath(`/products/${productId}`);
    }
    revalidatePath("/sales");
    revalidatePath("/dashboard");

    return { ok: true, saleId };
  } catch (error) {
    if (error instanceof StockContentionError) {
      return { ok: false, error: { message: error.message } };
    }
    console.error("create sale failed", error);
    return {
      ok: false,
      error: { message: "Could not record the sale. Please try again." },
    };
  }
}
