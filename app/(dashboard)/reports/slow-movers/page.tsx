import Link from "next/link";

import { PackageCheck } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSlowMovingProducts } from "@/features/reports/queries";
import { formatDateUTC, formatNumber } from "@/lib/format";

/** No sale in this many days puts a product on this report. */
const SLOW_MOVER_DAYS = 90;
/** Beyond this many days without a sale, stock is considered dead. */
const DEAD_STOCK_DAYS = 180;

/** Badge behind the Days Since Sale cell. Never-sold counts as dead stock. */
function slowMoverBadge(daysSinceSale: number | null) {
  if (daysSinceSale === null || daysSinceSale > DEAD_STOCK_DAYS) {
    return { label: "Dead Stock", tone: "red" as const };
  }
  return { label: "Slow Mover", tone: "amber" as const };
}

export default async function SlowMoversPage() {
  const products = await getSlowMovingProducts(SLOW_MOVER_DAYS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Slow Movers"
        description={`Products with no sales in the last ${SLOW_MOVER_DAYS} days, worst first.`}
      />

      {products.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No slow-moving products"
          description={`Every product has sold within the last ${SLOW_MOVER_DAYS} days — inventory is moving well.`}
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Product</TableHeader>
                <TableHeader>Category</TableHeader>
                <TableHeader align="right">Current Stock</TableHeader>
                <TableHeader>Last Sale Date</TableHeader>
                <TableHeader>Days Since Sale</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {products.map((product) => {
                const badge = slowMoverBadge(product.daysSinceSale);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p>
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {product.name}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-500">{product.sku}</p>
                    </TableCell>
                    <TableCell>{product.categoryName ?? "—"}</TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatNumber(product.currentStock)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {product.lastSaleDate
                        ? formatDateUTC(product.lastSaleDate)
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      <span className="ml-2 text-xs whitespace-nowrap text-slate-500">
                        {product.daysSinceSale === null
                          ? "never sold"
                          : `${product.daysSinceSale}d`}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        View Product
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableContainer>
      )}
    </div>
  );
}
