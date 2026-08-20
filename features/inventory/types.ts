export interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  expiryDate: Date;
  createdAt: Date;
}

export interface BatchWithProduct extends Batch {
  productName: string;
  productSku: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  batchId: string | null;
  type: "sale" | "purchase" | "adjustment" | "damage" | "return" | "expiry";
  quantity: number;
  referenceId: string | null;
  notes: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface StockMovementWithDetails extends StockMovement {
  productName: string;
  batchNumber: string | null;
  userName: string | null;
}

/** Discriminated result returned by the inventory server actions. */
export type InventoryActionResult =
  | { ok: true }
  | { ok: false; error: { message: string } };

export interface InventorySummary {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  batchCount: number;
  nearestExpiry: Date | null;
}

export interface ExpiryAlert {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  /** Unit cost of the batch — basis of the value-at-risk estimate. */
  purchasePrice: number;
  expiryDate: Date;
  daysUntilExpiry: number;
}