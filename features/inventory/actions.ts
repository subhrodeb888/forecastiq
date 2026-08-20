"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import { batches, stockMovements } from "@/db/schema";
import { adjustStockSchema, createBatchSchema } from "@/lib/validations/batch";

import { eq, sql } from "drizzle-orm";

import type { InventoryActionResult } from "./types";

/**
 * Create a batch and its opening "purchase" stock movement in one
 * transaction — either both exist, or neither does. The movement always
 * carries the signed-in user.
 *
 * Shaped for `useActionState` — always resolves with an
 * InventoryActionResult, never throws.
 */
export async function createBatch(
  formData: FormData,
): Promise<InventoryActionResult> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to manage inventory." },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const parsed = createBatchSchema.safeParse({
    productId: formData.get("productId"),
    batchNumber: formData.get("batchNumber"),
    quantity: formData.get("quantity"),
    purchasePrice: formData.get("purchasePrice"),
    expiryDate: formData.get("expiryDate"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: parsed.error.issues[0]?.message ?? "Invalid batch data.",
      },
    };
  }

  try {
    await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(batches)
        .values({
          productId: parsed.data.productId,
          batchNumber: parsed.data.batchNumber,
          quantity: parsed.data.quantity,
          purchasePrice: parsed.data.purchasePrice.toString(),
          expiryDate: parsed.data.expiryDate,
        })
        .returning({ id: batches.id });

      await tx.insert(stockMovements).values({
        productId: parsed.data.productId,
        batchId: batch.id,
        type: "purchase",
        quantity: parsed.data.quantity,
        notes: `Batch ${parsed.data.batchNumber} created`,
        userId,
      });
    });
  } catch (error) {
    console.error("create batch failed", error);
    return {
      ok: false,
      error: { message: "Could not create the batch. Please try again." },
    };
  }

  revalidatePath(`/products/${parsed.data.productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Record a stock adjustment against a product (optionally one batch). The
 * batch's existence and the non-negative result are verified before the
 * transaction writes anything; the movement row always carries the user.
 *
 * Shaped for `useActionState` — always resolves with an
 * InventoryActionResult, never throws.
 */
export async function adjustStock(
  formData: FormData,
): Promise<InventoryActionResult> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to manage inventory." },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const parsed = adjustStockSchema.safeParse({
    productId: formData.get("productId"),
    batchId: formData.get("batchId") || undefined,
    quantity: formData.get("quantity"),
    type: formData.get("type"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        message: parsed.error.issues[0]?.message ?? "Invalid adjustment.",
      },
    };
  }

  const { productId, batchId, quantity, type, reason } = parsed.data;

  try {
    if (batchId) {
      // Verify the batch exists and the adjustment won't drive it negative
      // before the transaction writes anything.
      const batchRows = await db
        .select({ quantity: batches.quantity })
        .from(batches)
        .where(eq(batches.id, batchId))
        .limit(1);

      const batch = batchRows[0];
      if (!batch) {
        return { ok: false, error: { message: "Batch not found." } };
      }
      if (batch.quantity + quantity < 0) {
        return {
          ok: false,
          error: { message: "Adjustment would result in negative stock." },
        };
      }
    }

    await db.transaction(async (tx) => {
      if (batchId) {
        await tx
          .update(batches)
          .set({ quantity: sql`${batches.quantity} + ${quantity}` })
          .where(eq(batches.id, batchId));
      }

      await tx.insert(stockMovements).values({
        productId,
        batchId: batchId ?? null,
        type,
        quantity,
        notes: reason,
        userId,
      });
    });
  } catch (error) {
    console.error("adjust stock failed", error);
    return {
      ok: false,
      error: { message: "Could not adjust the stock. Please try again." },
    };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
