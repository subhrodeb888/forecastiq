import type { PurchaseStatus } from "@/features/purchases/types";

/** Supplier option for select dropdowns. */
export interface SupplierOption {
  id: string;
  name: string;
}

/** A supplier record as stored in the database. */
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}

/** A supplier row with procurement stats, as rendered by the suppliers list. */
export interface SupplierListItem {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  /** Non-cancelled orders. */
  totalOrders: number;
  /** Non-cancelled spend, in whole rupees. */
  totalSpend: number;
  /** Display-ready total spend (formatCurrency). */
  totalSpendLabel: string;
  /** Mean days from purchaseDate to deliveryDate; null if nothing delivered. */
  averageDeliveryDays: number | null;
}

/** A purchase order row in the supplier detail page's recent-orders table. */
export interface SupplierRecentOrder {
  id: string;
  status: PurchaseStatus;
  purchaseDate: Date;
  totalAmount: number;
  /** Display-ready total (formatCurrency). */
  totalAmountLabel: string;
}
