import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().uuid("Invalid product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one item is required."),
  // Omitted → the action records the sale as of right now.
  saleDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
