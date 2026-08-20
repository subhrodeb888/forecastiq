import type { ForecastMetrics, ForecastPoint, PredictMetrics } from "@/services/ml";

/** "auto" = statistical auto-selection; "trained" = persisted Random Forest. */
export type ForecastMethod = "auto" | "trained";

/** Outcome of one forecast run, after persistence to the `forecasts` table. */
export interface ForecastGeneration {
  runId: string;
  productId: string;
  productName: string;
  method: ForecastMethod;
  model: string;
  horizonDays: number;
  generatedAt: string;
  confidenceScore: number;
  metrics: ForecastMetrics | PredictMetrics;
  points: ForecastPoint[];
  storedPoints: number;
}

/** Discriminated result returned by the forecast server action. */
export type ForecastActionResult =
  | { ok: true; data: ForecastGeneration }
  | { ok: false; error: { code: string; message: string } };

/** Product option shown in the forecast picker's searchable select. */
export interface ForecastProductOption {
  id: string;
  name: string;
  sku: string;
}

/** One stored forecast point, as rendered by the forecast chart and table. */
export interface StoredForecastPoint {
  id: string;
  date: Date;
  predictedDemand: number;
  lowerBound: number | null;
  upperBound: number | null;
}

/** One historical forecast run, as rendered by the forecast history list. */
export interface ForecastRunSummary {
  id: string;
  model: string;
  horizonDays: number;
  confidenceScore: number;
  generatedAt: Date;
}

/** Accuracy grade derived from MAPE: < 10% good, 10–20% acceptable, else poor. */
export type ForecastAccuracyStatus = "good" | "acceptable" | "poor";

/** One forecast run scored against the actual sales in its horizon window. */
export interface ForecastAccuracyRow {
  runId: string;
  /** Carried so the accuracy table can link to /forecast?product=<id>. */
  productId: string;
  productName: string;
  model: string;
  horizonDays: number;
  /** Mean absolute percentage error over scored days, one decimal. */
  mape: number;
  /** Root mean squared error over every compared day, one decimal. */
  rmse: number;
  /** Mean signed percentage error — positive means over-forecasting. */
  bias: number;
  status: ForecastAccuracyStatus;
}
