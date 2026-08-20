import { z } from "zod";

export const createBatchSchema = z.object({
  productId: z.string().uuid("Invalid product."),
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be greater than 0."),
  expiryDate: z.coerce.date(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.coerce.number().int(),
  type: z.enum(["adjustment", "damage", "return"]),
  reason: z.string().trim().min(1, "Reason is required."),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const deleteBatchSchema = z.object({
  batchId: z.string().uuid("Invalid batch."),
  productId: z.string().uuid("Invalid product."),
});

export type DeleteBatchInput = z.infer<typeof deleteBatchSchema>;