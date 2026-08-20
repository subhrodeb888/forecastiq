import { PieChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

import type { CategoryProfit } from "../types";

/** Margin badge tone: emerald above 20%, amber 10–20%, red below 10%. */
function marginTone(marginPercent: number): "emerald" | "amber" | "red" {
  if (marginPercent > 20) return "emerald";
  if (marginPercent >= 10) return "amber";
  return "red";
}

/** Revenue, cost, and margin per category, from the sale ledger. */
export function ProfitByCategoryTable({ rows }: { rows: CategoryProfit[] }) {
  return (
    <section
      aria-label="Profit by category"
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <header className="flex items-center gap-2 border-b px-4 py-4">
        <PieChart className="size-4 text-slate-400" aria-hidden />
        <h2 className="text-lg font-semibold">Profit by category</h2>
        <span className="ml-auto text-sm whitespace-nowrap text-slate-500">
          All-time sale ledger
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No sales recorded yet. Category profitability will appear here once
          orders come in.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Revenue
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cost
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Profit
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.categoryName}
                  className="border-t transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{row.categoryName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                    {formatCurrency(row.cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatCurrency(row.profit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={marginTone(row.marginPercent)}>
                      {row.marginPercent}%
                    </Badge>
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
