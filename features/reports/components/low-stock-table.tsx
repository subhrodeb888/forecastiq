import Link from "next/link";

import { PackageX } from "lucide-react";

import { formatNumber } from "@/lib/format";

import type { LowStockProduct } from "../types";

/** "Out of stock" (red) when empty, otherwise "Low stock" (amber). */
function StockBadge({ currentStock }: { currentStock: number }) {
  if (currentStock === 0) {
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-red-700">
        Out of stock
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-700">
      Low stock
    </span>
  );
}

/**
 * Products at or below their reorder level. The query orders lowest stock
 * first, so the most urgent restocks sit at the top.
 */
export function LowStockTable({ products }: { products: LowStockProduct[] }) {
  return (
    <section
      aria-label="Low stock products"
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <header className="flex items-center gap-2 border-b px-4 py-4">
        <PackageX className="size-4 text-slate-400" aria-hidden />
        <h2 className="text-lg font-semibold">Low stock alerts</h2>
        <span className="ml-auto text-sm whitespace-nowrap text-slate-500">
          {products.length === 1
            ? "1 product needs restocking"
            : `${products.length} products need restocking`}
        </span>
      </header>

      {products.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Inventory looks healthy — every product is above its reorder level.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">SKU</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Current Stock
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Reorder Level
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t transition-colors hover:bg-slate-50"
                >
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
                    {formatNumber(product.currentStock)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                    {formatNumber(product.reorderLevel)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StockBadge currentStock={product.currentStock} />
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
