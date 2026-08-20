/** Every lifecycle state a purchase order can be in. */
export const PURCHASE_STATUSES = [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * Orders still in flight — stock has not fully arrived. Drives the pending
 * purchase list and, later, the reorder engine's on-order quantities.
 */
export const PENDING_PURCHASE_STATUSES = [
  "draft",
  "ordered",
  "partially_received",
] as const satisfies readonly PurchaseStatus[];

/** A purchase order header with its supplier name resolved. */
export interface PurchaseOrder {
  id: string;
  supplierId: string | null;
  /** Null when the order has no supplier, or the supplier was deleted. */
  supplierName: string | null;
  status: PurchaseStatus;
  purchaseDate: Date;
  deliveryDate: Date | null;
  totalAmount: number;
  /** Display-ready total, e.g. "₹12,500" (formatCurrency). */
  totalAmountLabel: string;
  notes: string | null;
  createdAt: Date;
}

/** One line of a purchase order, with product identity resolved. */
export interface PurchaseOrderItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  /** Unit price paid to the supplier. */
  purchasePrice: number;
  /** Display-ready unit price (formatCurrency). */
  purchasePriceLabel: string;
  /** quantity × purchasePrice, computed in integer paise to avoid float drift. */
  lineTotal: number;
  /** Display-ready line total (formatCurrency). */
  lineTotalLabel: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

/**
 * Performance rollup for one supplier. Cancelled orders are excluded from
 * every metric — they represent no spend and no delivery.
 */
export interface SupplierSummary {
  id: string;
  name: string;
  totalOrders: number;
  totalSpend: number;
  /** Display-ready total spend (formatCurrency). */
  totalSpendLabel: string;
  /** Mean days from purchaseDate to deliveryDate; null if nothing delivered. */
  averageDeliveryDays: number | null;
}

/** Discriminated result returned by the purchase server actions. */
export type PurchaseActionResult =
  | { ok: true }
  | { ok: false; error: { message: string } };

/**
 * State shape for the create/receive forms. `errors` is keyed by field name;
 * line-item errors are keyed "items-{index}-{field}" (or
 * "receivedItems-{index}-{field}"), and non-field failures use "form".
 */
export interface PurchaseFormState {
  success: boolean;
  errors: Record<string, string[]>;
  /** Present on success — the form navigates to this order. */
  data?: { id: string };
}

/** Product option for the purchase order form's product picker. */
export interface PurchaseProductOption {
  id: string;
  name: string;
  sku: string;
  /** Catalog selling price — shown as a hint when pricing the line. */
  sellingPrice: number;
}
