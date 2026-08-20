"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { forecastRequestSchema } from "@/lib/validations/forecast";
import { MLServiceError } from "@/services/ml";

import { ForecastServiceError, generateForecastForProduct } from "./service";
import type { ForecastActionResult } from "./types";

/**
 * Request a demand forecast for a product: aggregates its sales history,
 * calls the ML service, and stores the run plus its points in the
 * `forecast_runs` / `forecasts` tables.
 *
 * Shaped for `useActionState` — always resolves with a typed result, never
 * throws, so callers can render the structured error (code + message)
 * directly.
 */
export async function requestForecastAction(
  _prevState: ForecastActionResult | null,
  formData: FormData,
): Promise<ForecastActionResult> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: {
        code: "unauthorized",
        message: "You must be signed in to generate forecasts.",
      },
    };
  }

  // Recorded on the forecast run — who asked for this prediction.
  const userId = session.user.id ?? null;

  const parsed = forecastRequestSchema.safeParse({
    productId: formData.get("productId"),
    horizonDays: formData.get("horizonDays"),
    method: formData.get("method"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid forecast request.",
      },
    };
  }

  // Forward the inbound request id so ML service logs correlate with ours.
  const requestId =
    (await headers()).get("x-request-id") ?? crypto.randomUUID();

  try {
    const data = await generateForecastForProduct({
      ...parsed.data,
      requestId,
      userId,
    });
    revalidatePath("/forecast");
    revalidatePath("/dashboard");
    revalidatePath(`/products/${parsed.data.productId}`);
    return { ok: true, data };
  } catch (error) {
    if (
      error instanceof MLServiceError ||
      error instanceof ForecastServiceError
    ) {
      if (
        error instanceof MLServiceError &&
        error.code === "validation_error"
      ) {
        return {
          ok: false,
          error: {
            code: error.code,
            message:
              "This product does not have enough sales history to generate a forecast.",
          },
        };
      }

      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    console.error("forecast generation failed", error);
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: "Forecast generation failed unexpectedly.",
      },
    };
  }
}
