import { db } from "@/db";
import { batches, stockMovements } from "@/db/schema";
import { and, asc, eq, gte, sql } from "drizzle-orm";

export interface AllocationResult {
  batchId: string;
  quantity: number;
}

/** Transaction handle, extracted from the db client's own transaction API. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Thrown when a concurrent sale drained a batch between allocation and
 * commit — the caller turns this into a retryable, user-facing error.
 */
export class StockContentionError extends Error {}

/**
 * Allocate stock using FEFO (First Expire, First Out).
 * Returns how much to take from each batch.
 * Throws if total available stock is insufficient.
 */
export async function allocateBatchesFEFO(
  productId: string,
  requestedQty: number,
): Promise<AllocationResult[]> {
  if (requestedQty <= 0) return [];

  const availableBatches = await db
    .select({
      id: batches.id,
      quantity: batches.quantity,
    })
    .from(batches)
    .where(eq(batches.productId, productId))
    .orderBy(asc(batches.expiryDate), asc(batches.createdAt));

  const totalAvailable = availableBatches.reduce(
    (sum, b) => sum + b.quantity,
    0,
  );

  if (totalAvailable < requestedQty) {
    throw new Error(
      `Insufficient stock. Requested ${requestedQty}, available ${totalAvailable}.`,
    );
  }

  const allocations: AllocationResult[] = [];
  let remaining = requestedQty;

  for (const batch of availableBatches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  return allocations;
}

/**
 * Deduct allocated quantities from batches and record sale movements.
 * Runs on the caller's transaction (`tx`) so a sale and its stock changes
 * commit or roll back together. Each deduction is guarded by the batch's
 * current quantity: if a concurrent sale drained the batch after allocation,
 * the update matches no row and a StockContentionError aborts the sale.
 */
export async function commitFEFOAllocation(
  tx: Tx,
  saleId: string,
  productId: string,
  allocations: AllocationResult[],
  userId?: string | null,
) {
  for (const alloc of allocations) {
    const updated = await tx
      .update(batches)
      .set({
        quantity: sql`${batches.quantity} - ${alloc.quantity}`,
      })
      .where(
        and(eq(batches.id, alloc.batchId), gte(batches.quantity, alloc.quantity)),
      )
      .returning({ id: batches.id });

    if (updated.length === 0) {
      throw new StockContentionError(
        "Stock changed while recording the sale — please try again.",
      );
    }

    await tx.insert(stockMovements).values({
      productId,
      batchId: alloc.batchId,
      type: "sale",
      quantity: -alloc.quantity,
      referenceId: saleId,
      userId: userId ?? null,
    });
  }
}
