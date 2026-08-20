import { z } from "zod";

/**
 * A batch row from the product form. Unlike createBatchSchema there is no
 * productId — the product is saved in the same request as its batches.
 */
export const productBatchSchema = z.object({
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be greater than 0."),
  expiryDate: z.coerce.date(),
});

export type ProductBatchInput = z.infer<typeof productBatchSchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name is required"),

  sku: z.string().trim().min(2, "SKU is required"),

  manufacturer: z.string().trim().optional(),

  categoryId: z.string().uuid().optional().or(z.literal("")),

  sellingPrice: z.coerce
    .number()
    .positive("Selling price must be greater than 0"),

  reorderLevel: z.coerce.number().int().min(0),

  safetyStock: z.coerce.number().int().min(0),

  // Stock comes from batches, never a manual stock field. Rows the user left
  // completely blank are dropped before validation, so this may be empty.
  batches: z.array(productBatchSchema),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
