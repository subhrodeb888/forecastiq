import { mlClient } from "@/services/ml";

import {
  getDailySalesHistory,
  getProductById,
  saveForecastRun,
} from "./queries";
import type { ForecastGeneration, ForecastMethod } from "./types";

/** A domain-level failure in the forecast flow (not an ML service failure). */
export class ForecastServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ForecastServiceError";
    this.code = code;
  }
}

export interface GenerateForecastParams {
  productId: string;
  method: ForecastMethod;
  horizonDays?: number;
  requestId?: string;
  /** Persisted on the forecast run — the signed-in user who requested it. */
  userId?: string | null;
}

/**
 * End-to-end forecast flow: load the product's daily sales from PostgreSQL,
 * request a forecast from the ML service, and persist the run plus its
 * points into the `forecast_runs` / `forecasts` tables.
 *
 * Domain rules (minimum history, horizon limits, model availability) stay
 * with the ML service — it returns the structured error envelope, which the
 * action layer maps straight through.
 */
export async function generateForecastForProduct(
  params: GenerateForecastParams,
): Promise<ForecastGeneration> {
  const product = await getProductById(params.productId);
  if (!product) {
    throw new ForecastServiceError(
      "product_not_found",
      `Product ${params.productId} does not exist.`,
    );
  }

  const history = await getDailySalesHistory(product.id);
  if (history.length === 0) {
    throw new ForecastServiceError(
      "empty_sales_history",
      `"${product.name}" has no recorded sales yet.`,
    );
  }

  const request = {
    product_id: product.id,
    history,
    horizon_days: params.horizonDays,
    include_intervals: true,
  };

  const response =
    params.method === "trained"
      ? await mlClient.predict(request, params.requestId)
      : await mlClient.forecast(
          { ...request, model: "auto" },
          params.requestId,
        );

  const runId = await saveForecastRun(product.id, response, params.userId);

  return {
    runId,
    productId: product.id,
    productName: product.name,
    method: params.method,
    model: response.model,
    horizonDays: response.horizon_days,
    generatedAt: response.generated_at,
    confidenceScore: response.metrics.confidence_score,
    metrics: response.metrics,
    points: response.points,
    storedPoints: response.points.length,
  };
}
