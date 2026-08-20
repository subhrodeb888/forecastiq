import { z } from "zod";

/**
 * Runtime contracts for the ForecastIQ ML service (FastAPI).
 *
 * These mirror the pydantic schemas in `ml-service/app/schemas/`; responses
 * are validated at the boundary so the rest of the app can trust the types.
 */

export const salesHistoryPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)."),
  quantity: z.number().int().nonnegative(),
});

export const forecastPointSchema = z.object({
  date: z.string(),
  predicted_demand: z.number().int().nonnegative(),
  lower_bound: z.number().int().nonnegative().nullable(),
  upper_bound: z.number().int().nonnegative().nullable(),
});

export const forecastResponseSchema = z.object({
  product_id: z.string().uuid(),
  model: z.string(),
  horizon_days: z.number().int(),
  season_length: z.number().int().nullable(),
  generated_at: z.string(),
  points: z.array(forecastPointSchema),
  metrics: z.object({
    mae: z.number(),
    smape: z.number(),
    confidence_score: z.number().min(0).max(100),
  }),
});

export const predictResponseSchema = z.object({
  product_id: z.string().uuid(),
  model: z.string(),
  horizon_days: z.number().int(),
  generated_at: z.string(),
  points: z.array(forecastPointSchema),
  metrics: z.object({
    mae: z.number(),
    rmse: z.number(),
    r2: z.number(),
    confidence_score: z.number().min(0).max(100),
    trained_at: z.string(),
  }),
});

/** Consistent failure shape returned by every ML service error path. */
export const mlErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullish(),
  }),
  request_id: z.string().nullish(),
});

export type SalesHistoryPoint = z.infer<typeof salesHistoryPointSchema>;
export type ForecastPoint = z.infer<typeof forecastPointSchema>;
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
export type PredictResponse = z.infer<typeof predictResponseSchema>;
export type ForecastMetrics = ForecastResponse["metrics"];
export type PredictMetrics = PredictResponse["metrics"];
