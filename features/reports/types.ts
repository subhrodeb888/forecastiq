/** Headline KPIs shown at the top of the reports dashboard. */
export interface ReportsKpis {
  /** All-time revenue across every recorded sale, in whole rupees. */
  totalRevenue: number;
  /** All-time number of recorded sales. */
  totalSales: number;
  /** Products currently in the catalog. */
  totalProducts: number;
  /** Forecast runs generated so far (one run = one generated forecast). */
  totalForecasts: number;
}

/** One point of the monthly revenue line chart, with a preformatted label. */
export interface RevenueChartPoint {
  /** Display label, e.g. "Aug 2025". */
  month: string;
  revenue: number;
}

/** One month of sales performance, as rendered by the monthly sales table. */
export interface MonthlySalesRow {
  /** First day of the month, at UTC midnight. */
  month: Date;
  totalOrders: number;
  revenue: number;
  avgOrderValue: number;
}

/** A product ranked by total units sold. */
export interface TopSellingProduct {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  /** Revenue from the sale ledger — the price at the time of each sale. */
  revenue: number;
}

/** A product at or below its reorder level. */
export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
}

/** Revenue, cost, and margin rollup for one category. */
export interface CategoryProfit {
  /** "Uncategorized" groups products without a category. */
  categoryName: string;
  /** sum(sellingPrice × qty) — the price at the time of each sale. */
  revenue: number;
  /** sum(unitCost × qty) — sold batch's purchase price, else the product's average batch cost. */
  cost: number;
  profit: number;
  /** (profit / revenue) × 100, one decimal place; 0 when revenue is 0. */
  marginPercent: number;
}

/** A product with no recorded sale inside the slow-mover window. */
export interface SlowMovingProduct {
  id: string;
  name: string;
  sku: string;
  /** Null when the product has no category. */
  categoryName: string | null;
  currentStock: number;
  /** Null when the product has never been sold. */
  lastSaleDate: Date | null;
  /** Whole days since the last sale; null when never sold. */
  daysSinceSale: number | null;
}
