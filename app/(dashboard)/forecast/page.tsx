import { PackageSearch, TrendingUp } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ForecastChart } from "@/features/forecast/components/forecast-chart";
import { ForecastControls } from "@/features/forecast/components/forecast-controls";
import { ForecastHistory } from "@/features/forecast/components/forecast-history";
import { ForecastTable } from "@/features/forecast/components/forecast-table";
import {
  getForecastRuns,
  getStoredForecasts,
  listForecastProducts,
} from "@/features/forecast/queries";

interface ForecastPageProps {
  searchParams: Promise<{ product?: string | string[] }>;
}

export default async function ForecastPage({ searchParams }: ForecastPageProps) {
  const { product: productParam } = await searchParams;
  const productId = Array.isArray(productParam) ? productParam[0] : productParam;

  const products = await listForecastProducts();
  const selectedProduct = products.find((product) => product.id === productId) ?? null;

  const [points, runs] = selectedProduct
    ? await Promise.all([
        getStoredForecasts(selectedProduct.id),
        getForecastRuns(selectedProduct.id),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Demand Forecasts</h1>
        <p className="mt-1 text-slate-500">
          Generate ML-powered demand forecasts from recorded sales history.
        </p>
      </header>

      {/* Keyed by product so action feedback resets when the selection changes. */}
      <ForecastControls
        key={selectedProduct?.id ?? "none"}
        products={products}
        selectedProduct={selectedProduct}
      />

      {!selectedProduct ? (
        <EmptyState
          icon={PackageSearch}
          title="Select a product"
          description="Choose a product above to view its stored forecasts, or generate a new one from its sales history."
        />
      ) : (
        <>
          {points.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title={`No forecasts for ${selectedProduct.name} yet`}
              description="Pick a horizon and click Generate Forecast to create the first prediction for this product."
            />
          ) : (
            <>
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">Forecast outlook</h2>
                  <span className="text-sm text-slate-500">{selectedProduct.name}</span>
                </div>
                <ForecastChart points={points} />
              </section>

              <ForecastTable points={points} />
            </>
          )}

          <ForecastHistory runs={runs} />
        </>
      )}
    </div>
  );
}
