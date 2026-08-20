import type { z } from "zod";
import { env } from "@/lib/env";


import { MLServiceError, MLServiceUnavailableError } from "./errors";
import {
  type ForecastResponse,
  type PredictResponse,
  type SalesHistoryPoint,
  forecastResponseSchema,
  mlErrorEnvelopeSchema,
  predictResponseSchema,
} from "./types";

const API_PREFIX = "/api/v1";
const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ForecastRequestInput {
  product_id: string;
  history: SalesHistoryPoint[];
  horizon_days?: number;
  model?: "auto" | "moving_average" | "linear_trend" | "holt_winters";
  season_length?: number;
  include_intervals?: boolean;
}

export type PredictRequestInput = Omit<ForecastRequestInput, "model" | "season_length">;

export interface MLClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Typed HTTP client for the ForecastIQ ML service.
 *
 * Reads `ML_SERVICE_URL` / `ML_SERVICE_TIMEOUT_MS` from the environment by
 * default. Every call carries an optional `X-Request-ID` for end-to-end
 * tracing, aborts after the configured timeout, validates responses against
 * the zod contracts, and normalizes all failure modes to `MLServiceError`.
 */
export class MLClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: MLClientConfig = {}) {
    this.baseUrl = (
      config.baseUrl ??
      env.ML_SERVICE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.timeoutMs =
      config.timeoutMs ?? Number(process.env.ML_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  /** Statistical auto-selection forecast (`POST /forecasts`). */
  forecast(input: ForecastRequestInput, requestId?: string): Promise<ForecastResponse> {
    return this.post("/forecasts", input, forecastResponseSchema, requestId);
  }

  /** Trained-model prediction (`POST /predict`); 404 when no model is trained. */
  predict(input: PredictRequestInput, requestId?: string): Promise<PredictResponse> {
    return this.post("/predict", input, predictResponseSchema, requestId);
  }

  private async post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    requestId: string | undefined,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${API_PREFIX}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestId ? { "X-Request-ID": requestId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new MLServiceUnavailableError(
          `ML service did not respond within ${this.timeoutMs}ms.`,
          { cause: error },
        );
      }
      throw new MLServiceUnavailableError("ML service is unreachable.", { cause: error });
    }

    if (!response.ok) {
      throw await toServiceError(response);
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new MLServiceError("ML service returned an unexpected response shape.", {
        code: "invalid_response",
        status: 502,
      });
    }
    return parsed.data;
  }
}

/** Map a non-2xx response to a structured error, honoring the error envelope. */
async function toServiceError(response: Response): Promise<MLServiceError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error body — fall through to the generic error below.
  }
  const envelope = mlErrorEnvelopeSchema.safeParse(payload);
  if (envelope.success) {
    return new MLServiceError(envelope.data.error.message, {
      code: envelope.data.error.code,
      status: response.status,
      details: envelope.data.error.details ?? undefined,
      requestId: envelope.data.request_id ?? undefined,
    });
  }
  return new MLServiceError(`ML service request failed with status ${response.status}.`, {
    code: "http_error",
    status: response.status,
  });
}

/** Shared client for server-side code (reads env config once). */
export const mlClient = new MLClient();
