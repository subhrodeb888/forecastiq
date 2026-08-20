"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { humanizeToken } from "@/lib/format";
import { FORECAST_HORIZONS } from "@/lib/validations/forecast";
import { ProductCombobox } from "@/components/product-combobox";

import { requestForecastAction } from "../actions";
import type { ForecastProductOption } from "../types";

interface ForecastControlsProps {
  products: ForecastProductOption[];
  selectedProduct: ForecastProductOption | null;
  salesHistoryDays: number;
}

export function ForecastControls({
  products,
  selectedProduct,
  salesHistoryDays,
}: ForecastControlsProps) {
  const MIN_HISTORY_DAYS = 8;
  const hasEnoughHistory = salesHistoryDays >= MIN_HISTORY_DAYS;
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    requestForecastAction,
    null,
  );
  const [isNavPending, startNavTransition] = useTransition();

  const selectProduct = (product: ForecastProductOption) => {
    startNavTransition(() => {
      router.push(`/forecast?product=${product.id}`, { scroll: false });
    });
  };

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <form
        action={formAction}
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end"
      >
        <input
          type="hidden"
          name="productId"
          value={selectedProduct?.id ?? ""}
        />

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Product
          </span>

          <ProductCombobox
            products={products}
            value={selectedProduct}
            onChange={selectProduct}
            disabled={isPending}
            loading={isNavPending}
          />
        </div>

        <div>
          <label
            htmlFor="horizonDays"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Horizon
          </label>

          <select
            id="horizonDays"
            name="horizonDays"
            defaultValue="30"
            disabled={isPending}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            {FORECAST_HORIZONS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={
            !selectedProduct || !hasEnoughHistory || isPending || isNavPending
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate Forecast
            </>
          )}
        </button>
      </form>

      {selectedProduct && !hasEnoughHistory && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Insufficient sales history</p>
          <p className="mt-0.5">
            This product has {salesHistoryDays} day
            {salesHistoryDays === 1 ? "" : "s"} of sales history. At least{" "}
            {MIN_HISTORY_DAYS} days are required to generate a forecast.
          </p>
        </div>
      )}

      {state && !state.ok && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Forecast failed</p>
            <p className="mt-0.5">
              {state.error.message}{" "}
              <span className="text-red-400">({state.error.code})</span>
            </p>
          </div>
        </div>
      )}

      {state?.ok && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>
            Forecast generated with{" "}
            <span className="font-medium">
              {humanizeToken(state.data.model)}
            </span>{" "}
            · {state.data.horizonDays}-day horizon · confidence{" "}
            {Math.round(state.data.confidenceScore)}% ·{" "}
            {state.data.storedPoints} points saved.
          </p>
        </div>
      )}
    </section>
  );
}
