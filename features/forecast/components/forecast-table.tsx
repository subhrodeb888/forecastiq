import { formatDateUTC } from "@/lib/format";

import type { StoredForecastPoint } from "../types";

/**
 * Stored forecast points for the selected product, one row per date,
 * ascending (the query already orders by date).
 */
export function ForecastTable({ points }: { points: StoredForecastPoint[] }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <header className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Forecast details</h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 text-right font-medium">Predicted Demand</th>
              <th className="px-6 py-3 text-right font-medium">Lower Bound</th>
              <th className="px-6 py-3 text-right font-medium">Upper Bound</th>
            </tr>
          </thead>

          <tbody>
            {points.map((point) => (
              <tr key={point.id} className="border-t transition-colors hover:bg-slate-50">
                <td className="px-6 py-3 whitespace-nowrap">
                  {formatDateUTC(point.date)}
                </td>
                <td className="px-6 py-3 text-right font-medium tabular-nums">
                  {point.predictedDemand.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-slate-500 tabular-nums">
                  {point.lowerBound?.toLocaleString() ?? "—"}
                </td>
                <td className="px-6 py-3 text-right text-slate-500 tabular-nums">
                  {point.upperBound?.toLocaleString() ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
