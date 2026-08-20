import Link from "next/link";

import { Trophy } from "lucide-react";

import { formatCurrency, formatNumber } from "@/lib/format";

import type { TopSellingProduct } from "../types";

/** Top three ranks get a highlighted badge. */
function rankBadgeClass(index: number): string {
  return index < 3 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500";
}

/** Top products ranked by units sold, with the revenue they generated. */
export function TopProductsTable({ products }: { products: TopSellingProduct[] }) {
  return (
    <section
      aria-label="Top selling products"
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <header className="flex items-center gap-2 border-b px-4 py-4">
        <Trophy className="size-4 text-slate-400" aria-hidden />
        <h2 className="text-lg font-semibold">Top selling products</h2>
        <span className="ml-auto text-sm whitespace-nowrap text-slate-500">
          Top {products.length} by units sold
        </span>
      </header>

      {products.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No sales recorded yet. Top sellers will appear here once orders come in.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="w-12 px-4 py-3 font-medium">
                  <span className="sr-only">Rank</span>#
                </th>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">SKU</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Units Sold</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr
                  key={product.id}
                  className="border-t transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${rankBadgeClass(index)}`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 font-medium">
                    <Link
                      href={`/products/${product.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatNumber(product.unitsSold)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(product.revenue)}
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
