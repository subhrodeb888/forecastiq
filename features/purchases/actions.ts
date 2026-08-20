"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  batches,
  products,
  purchaseItems,
  purchases,
  stockMovements,
} from "@/db/schema";
import { paiseToMoney, toPaise } from "@/features/inventory/money";
import { parseIndexedItems } from "@/lib/form-data";
import {
  cancelPurchaseOrderSchema,
  createPurchaseOrderSchema,
  placePurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from "@/lib/validations/purchase";

import { and, eq, sql } from "drizzle-orm";

import { z } from "zod";

import {
  PENDING_PURCHASE_STATUSES,
  type PurchaseActionResult,
  type PurchaseFormState,
} from "./types";

/**
 * Map Zod issues to field-keyed messages: root fields keyed by name,
 * line-item fields keyed "{prefix}-{index}-{field}", and anything else under
 * "form".
 */
function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const [head, second, field] = issue.path;
    const key =
      typeof second === "number"
        ? `${String(head)}-${second}-${String(field ?? "form")}`
        : String(head ?? "form");
    (errors[key] ??= []).push(issue.message);
  }

  return errors;
}

/**
 * Create a purchase order with its line items. The total is computed
 * server-side from the items (quantity × unit price, summed in integer
 * paise) so a client-supplied total can never drift from the lines.
 *
 * No stock movements are recorded at creation — even for an "ordered"
 * purchase, stock only enters inventory when the order is received.
 *
 * Shaped for `useActionState`: returns field-keyed validation errors for
 * inline display, and the new order's id on success (which the form turns
 * into a client-side redirect). Never throws or calls redirect() itself.
 */
export async function createPurchaseOrder(
  _prevState: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      errors: {
        form: ["You must be signed in to create purchase orders."],
      },
    };
  }

  const items = parseIndexedItems(formData, "items");

  const parsed = createPurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId") || undefined,
    status: formData.get("status") || undefined,
    deliveryDate: formData.get("deliveryDate") || undefined,
    notes: formData.get("notes") || undefined,
    items,
  });
  if (!parsed.success) {
    return { success: false, errors: zodToFieldErrors(parsed.error) };
  }

  const { supplierId, status, deliveryDate, notes } = parsed.data;

  const totalPaise = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * toPaise(item.purchasePrice),
    0,
  );

  let orderId: string;

  try {
    orderId = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(purchases)
        .values({
          supplierId: supplierId ?? null,
          status,
          deliveryDate: deliveryDate || null,
          notes: notes || null,
          totalAmount: paiseToMoney(totalPaise),
        })
        .returning({ id: purchases.id });

      await tx.insert(purchaseItems).values(
        parsed.data.items.map((item) => ({
          purchaseId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          purchasePrice: paiseToMoney(toPaise(item.purchasePrice)),
        })),
      );

      return order.id;
    });
  } catch (error) {
    console.error("create purchase order failed", error);
    return {
      success: false,
      errors: {
        form: ["Could not create the purchase order. Please try again."],
      },
    };
  }

  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  return { success: true, errors: {}, data: { id: orderId } };
}

/**
 * Record a (possibly partial) goods receipt against a purchase order. Every
 * received line creates a batch — priced from the order line, never the
 * form — plus a "purchase" stock movement carrying the order id, which is
 * how cumulative receipts are tracked across multiple partial deliveries
 * (purchase_items has no received-quantity column). The order flips to
 * "received" once every line is fully received, stamping the delivery date;
 * otherwise it becomes "partially_received".
 *
 * Shaped for `useActionState`: returns field-keyed validation errors for
 * inline display, and the order's id on success (which the form turns into a
 * client-side redirect). Not-found, wrong-status, and over-receipt all
 * resolve as form-level errors; never throws or calls redirect() itself.
 */
export async function receivePurchaseOrder(
  _prevState: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      errors: {
        form: ["You must be signed in to receive purchase orders."],
      },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const receivedItems = parseIndexedItems(formData, "receivedItems");

  const parsed = receivePurchaseOrderSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
    receivedItems,
  });
  if (!parsed.success) {
    return { success: false, errors: zodToFieldErrors(parsed.error) };
  }

  const { purchaseId } = parsed.data;

  // Zero-quantity lines mean "not received this time" — they create no batch.
  const receiptLines = parsed.data.receivedItems.filter(
    (line) => line.quantity > 0,
  );
  if (receiptLines.length === 0) {
    return {
      success: false,
      errors: {
        form: ["Nothing to receive — every quantity is zero."],
      },
    };
  }

  const receivedProductIds = [
    ...new Set(receiptLines.map((line) => line.productId)),
  ];

  try {
    const orderRows = await db
      .select({ id: purchases.id, status: purchases.status })
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return {
        success: false,
        errors: { form: ["Purchase order not found."] },
      };
    }
    if (
      !(PENDING_PURCHASE_STATUSES as readonly string[]).includes(order.status)
    ) {
      return {
        success: false,
        errors: {
          form: [
            order.status === "cancelled"
              ? "This purchase order was cancelled."
              : "This purchase order is already fully received.",
          ],
        },
      };
    }

    const orderLines = await db
      .select({
        productId: purchaseItems.productId,
        productName: products.name,
        quantity: purchaseItems.quantity,
        purchasePrice: purchaseItems.purchasePrice,
      })
      .from(purchaseItems)
      .innerJoin(products, eq(purchaseItems.productId, products.id))
      .where(eq(purchaseItems.purchaseId, purchaseId));

    const orderedByProduct = new Map(
      orderLines.map((line) => [line.productId, line]),
    );
    if (receiptLines.some((line) => !orderedByProduct.has(line.productId))) {
      return {
        success: false,
        errors: {
          form: ["One or more received items are not part of this order."],
        },
      };
    }

    const priorRows = await db
      .select({
        productId: stockMovements.productId,
        received: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.referenceId, purchaseId),
          eq(stockMovements.type, "purchase"),
        ),
      )
      .groupBy(stockMovements.productId);

    const receivedByProduct = new Map(
      priorRows.map((row) => [row.productId, Number(row.received)]),
    );

    // Duplicate lines for one product are allowed (split batches) — validate
    // and total them per product.
    const thisReceiptByProduct = new Map<string, number>();
    for (const line of receiptLines) {
      thisReceiptByProduct.set(
        line.productId,
        (thisReceiptByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }

    for (const [productId, qty] of thisReceiptByProduct) {
      const line = orderedByProduct.get(productId)!;
      const remaining =
        line.quantity - (receivedByProduct.get(productId) ?? 0);
      if (qty > remaining) {
        return {
          success: false,
          errors: {
            form: [
              `Cannot receive ${qty} units of ${line.productName} — only ${remaining} remain on this order.`,
            ],
          },
        };
      }
    }

    const fullyReceived = orderLines.every(
      (line) =>
        (receivedByProduct.get(line.productId) ?? 0) +
          (thisReceiptByProduct.get(line.productId) ?? 0) >=
        line.quantity,
    );

    await db.transaction(async (tx) => {
      for (const line of receiptLines) {
        const orderLine = orderedByProduct.get(line.productId)!;

        const [batch] = await tx
          .insert(batches)
          .values({
            productId: line.productId,
            batchNumber: line.batchNumber,
            quantity: line.quantity,
            // Already a numeric(10,2) string straight from the order line.
            purchasePrice: orderLine.purchasePrice,
            // SuperRefine guarantees a real Date for quantity>0 lines — the
            // union type never narrows, so assert it here.
            expiryDate: line.expiryDate as Date,
          })
          .returning({ id: batches.id });

        await tx.insert(stockMovements).values({
          productId: line.productId,
          batchId: batch.id,
          type: "purchase",
          quantity: line.quantity,
          referenceId: purchaseId,
          notes: `Batch ${line.batchNumber} received`,
          userId,
        });
      }

      await tx
        .update(purchases)
        .set(
          fullyReceived
            ? // The delivery date records when the order finished arriving.
              { status: "received", deliveryDate: new Date() }
            : { status: "partially_received" },
        )
        .where(eq(purchases.id, purchaseId));
    });
  } catch (error) {
    console.error("receive purchase order failed", error);
    return {
      success: false,
      errors: {
        form: ["Could not receive the purchase order. Please try again."],
      },
    };
  }

  revalidatePath("/purchases");
  revalidatePath(`/purchases/${purchaseId}`);
  for (const productId of receivedProductIds) {
    revalidatePath(`/products/${productId}`);
  }
  revalidatePath("/dashboard");
  return { success: true, errors: {}, data: { id: purchaseId } };
}

/**
 * Cancel a purchase order. Draft, ordered, and partially received orders can
 * be cancelled (a partially received cancellation simply closes out a
 * short-shipped order — stock already received stays in inventory). Received
 * orders cannot: cancelling would orphan the batches they created.
 *
 * Shaped for `useActionState` — always resolves with a PurchaseActionResult,
 * never throws.
 */
export async function cancelPurchaseOrder(
  formData: FormData,
): Promise<PurchaseActionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to cancel purchase orders." },
    };
  }

  const parsed = cancelPurchaseOrderSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid purchase order." } };
  }

  const { purchaseId } = parsed.data;

  try {
    const orderRows = await db
      .select({ id: purchases.id, status: purchases.status })
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return { ok: false, error: { message: "Purchase order not found." } };
    }
    if (order.status === "cancelled") {
      return {
        ok: false,
        error: { message: "This purchase order is already cancelled." },
      };
    }
    if (order.status === "received") {
      return {
        ok: false,
        error: {
          message:
            "Received orders cannot be cancelled — the stock is already in inventory.",
        },
      };
    }

    // Single statement — no transaction needed.
    await db
      .update(purchases)
      .set({ status: "cancelled" })
      .where(eq(purchases.id, purchaseId));
  } catch (error) {
    console.error("cancel purchase order failed", error);
    return {
      ok: false,
      error: {
        message: "Could not cancel the purchase order. Please try again.",
      },
    };
  }

  revalidatePath("/purchases");
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Move a draft order to "ordered" — the point at which it has been sent to
 * the supplier. Stock still arrives only via receivePurchaseOrder.
 *
 * Shaped for `useActionState` — always resolves with a PurchaseActionResult,
 * never throws.
 */
export async function placePurchaseOrder(
  formData: FormData,
): Promise<PurchaseActionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to place purchase orders." },
    };
  }

  const parsed = placePurchaseOrderSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid purchase order." } };
  }

  const { purchaseId } = parsed.data;

  try {
    const orderRows = await db
      .select({ id: purchases.id, status: purchases.status })
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    const order = orderRows[0];
    if (!order) {
      return { ok: false, error: { message: "Purchase order not found." } };
    }
    if (order.status !== "draft") {
      return {
        ok: false,
        error: { message: "Only draft orders can be placed." },
      };
    }

    // Single statement — no transaction needed.
    await db
      .update(purchases)
      .set({ status: "ordered" })
      .where(eq(purchases.id, purchaseId));
  } catch (error) {
    console.error("place purchase order failed", error);
    return {
      ok: false,
      error: {
        message: "Could not place the purchase order. Please try again.",
      },
    };
  }

  revalidatePath("/purchases");
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

