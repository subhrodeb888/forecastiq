/** Discriminated result returned by the sales server actions. */
export type SaleActionResult =
  | { ok: true; saleId: string }
  | { ok: false; error: { message: string } };

/** Product option for the sale form's product select. */
export interface SaleProductOption {
  id: string;
  name: string;
  sku: string;
}

/** A sale row on the sales list page. */
export interface SaleListItem {
  id: string;
  saleDate: Date;
  /** Line-item count (one row per FEFO batch allocation). */
  itemCount: number;
  totalAmount: number;
  /** Display-ready total (formatCurrency). */
  totalAmountLabel: string;
}

/** Today's trading snapshot — the dashboard's sales KPI. */
export interface TodaysSalesSummary {
  totalRevenue: number;
  salesCount: number;
}
