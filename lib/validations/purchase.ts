import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  productId: z.string().uuid("Invalid product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be greater than 0."),
});

/** Local midnight — base for the "today or later" checks below. */
function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Strictly after the current instant — used by the expiry-date check. */
function isInTheFuture(value: Date): boolean {
  return value.getTime() > Date.now();
}

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Select a supplier."),
  status: z
    .enum(["draft", "ordered", "partially_received", "received", "cancelled"])
    .default("draft"),
  // Blank is allowed (no expected delivery yet); a provided date must be
  // today or later.
  deliveryDate: z
    .union([z.literal(""), z.coerce.date()])
    .refine(
      (value) => value === "" || value.getTime() >= startOfToday().getTime(),
      { message: "Delivery date must be today or later." },
    ),
  notes: z.string().trim().optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one item is required."),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const receivePurchaseOrderSchema = z.object({
  purchaseId: z.string().uuid(),
  // A line only needs its batch/expiry details once it actually receives
  // stock — a zero-quantity line can stay blank.
  receivedItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(0),
        batchNumber: z.string().trim(),
        expiryDate: z.union([z.literal(""), z.coerce.date()]),
      }),
    )
    .superRefine((items, ctx) => {
      items.forEach((item, index) => {
        if (item.quantity > 0) {
          if (!item.batchNumber) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "batchNumber"],
              message: "Batch number is required when receiving stock.",
            });
          }
          if (!item.expiryDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "expiryDate"],
              message: "Expiry date is required when receiving stock.",
            });
          } else if (!isInTheFuture(item.expiryDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "expiryDate"],
              message: "Expiry date must be in the future.",
            });
          }
        }
      });
    }),
});

export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;

export const cancelPurchaseOrderSchema = z.object({
  purchaseId: z.string().uuid(),
});

export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

export const placePurchaseOrderSchema = z.object({
  purchaseId: z.string().uuid(),
});

export type PlacePurchaseOrderInput = z.infer<typeof placePurchaseOrderSchema>;