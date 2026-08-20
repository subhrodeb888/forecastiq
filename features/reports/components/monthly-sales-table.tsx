import { ClipboardList } from "lucide-react";

import { formatCurrency, formatMonthUTC, formatNumber } from "@/lib/format";

import type { MonthlySalesRow } from "../types";

/** Month-by-month sales performance. The query orders newest month first. */
export function MonthlySalesTable({ rows }: { rows: MonthlySalesRow[] }) {
  return (
    <section
      aria-label="Monthly sales summary"
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <header className="flex items-center gap-2 border-b px-6 py-4">
        <ClipboardList className="size-4 text-slate-400" aria-hidden />
        <h2 className="text-lg font-semibold">Monthly sales</h2>
        <span className="ml-auto text-sm text-slate-500">Newest first</span>
      </header>

      {rows.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          No sales recorded in the covered months yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Month</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">
                  Total Orders
                </th>
                <th scope="col" className="px-6 py-3 text-right font-medium">Revenue</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">
                  Avg. Order Value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.month.toISOString()}
                  className="border-t transition-colors hover:bg-slate-50"
                >
                  <td className="px-6 py-3 font-medium whitespace-nowrap">
                    {formatMonthUTC(row.month)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {formatNumber(row.totalOrders)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium tabular-nums">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-500 tabular-nums">
                    {formatCurrency(row.avgOrderValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
