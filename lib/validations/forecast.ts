import { z } from "zod";

/** Horizon options (days) offered by the forecast UI and enforced here. */
export const FORECAST_HORIZONS = [7, 14, 30, 60, 90] as const;

export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

/** Empty form fields arrive as null/"" — treat them as "not provided". */
const optionalField = (value: unknown) =>
  value === null || value === "" ? undefined : value;

export const forecastRequestSchema = z.object({
  productId: z.string().uuid("Invalid product."),

  // Domain limits (max horizon, minimum history) are enforced by the ML
  // service, which returns the authoritative structured error.
  horizonDays: z.preprocess(
    optionalField,
    z.coerce
      .number()
      .int("Horizon must be a whole number of days.")
      .refine((value) => (FORECAST_HORIZONS as readonly number[]).includes(value), {
        message: `Horizon must be one of ${FORECAST_HORIZONS.join(", ")} days.`,
      })
      .optional(),
  ),

  method: z.preprocess(optionalField, z.enum(["auto", "trained"]).default("auto")),
});

export type ForecastRequestInput = z.infer<typeof forecastRequestSchema>;
