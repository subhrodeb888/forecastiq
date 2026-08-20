import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PackageOpen,
  PackagePlus,
  Pencil,
  Receipt,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MovementTypeBadge } from "@/features/inventory/components/movement-type-badge";
import {
  getProductBatches,
  getStockMovements,
} from "@/features/inventory/queries";
import { DeleteBatchButton } from "@/features/products/components/delete-batch-button";
import {
  formatCurrency,
  formatDateTime,
  formatDateUTC,
  formatNumber,
  formatRelativeTime,
} from "@/lib/format";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

const RECENT_MOVEMENTS_LIMIT = 10;
const EXPIRING_SOON_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Expiry status of a batch, compared against right now. */
function getBatchStatus(expiryDate: Date) {
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / MS_PER_DAY);
  if (daysLeft < 0) return { label: "Expired", tone: "red" as const };
  if (daysLeft < EXPIRING_SOON_DAYS) {
    return { label: "Expiring Soon", tone: "amber" as const };
  }
  return { label: "Good", tone: "emerald" as const };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  // Independent reads — fetched in parallel over the pooled connection.
  const [result, productBatches, movements] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        manufacturer: products.manufacturer,
        sellingPrice: products.sellingPrice,
        reorderLevel: products.reorderLevel,
        safetyStock: products.safetyStock,
        category: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id))
      .limit(1),
    getProductBatches(id),
    getStockMovements(id, RECENT_MOVEMENTS_LIMIT),
  ]);

  const product = result[0];
  if (!product) notFound();

  const totalQuantity = productBatches.reduce(
    (sum, batch) => sum + batch.quantity,
    0,
  );
  const stockThreshold = product.reorderLevel + product.safetyStock;
  const stockStatus =
    totalQuantity === 0
      ? { label: "Out of Stock", tone: "red" as const }
      : totalQuantity <= stockThreshold
        ? { label: "Low Stock", tone: "amber" as const }
        : { label: "In Stock", tone: "emerald" as const };
  // Batches arrive FEFO-ordered, so the first one with stock expires first;
  // depleted batches have nothing left to expire.
  const nearestExpiry =
    productBatches.filter((batch) => batch.quantity > 0)[0]?.expiryDate ??
    null;

  return (
    <div className="space-y-6">
      <PageHeader title={product.name}>
        <ButtonLink variant="secondary" href={`/products/${product.id}/edit`}>
          <Pencil className="size-4" aria-hidden />
          Edit
        </ButtonLink>
        <ButtonLink href={`/forecast?product=${product.id}`}>
          <TrendingUp className="size-4" aria-hidden />
          Forecast
        </ButtonLink>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">SKU</dt>
              <dd className="mt-1 text-slate-900">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Manufacturer</dt>
              <dd className="mt-1 text-slate-900">
                {product.manufacturer ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Category</dt>
              <dd className="mt-1 text-slate-900">{product.category ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Selling Price</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatCurrency(Number(product.sellingPrice))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Reorder Level</dt>
              <dd className="mt-1 tabular-nums text-slate-900">
                {formatNumber(product.reorderLevel)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Safety Stock</dt>
              <dd className="mt-1 tabular-nums text-slate-900">
                {formatNumber(product.safetyStock)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Status</CardTitle>
          <Badge tone={stockStatus.tone} className="ml-auto">
            {stockStatus.label}
          </Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">Total Quantity</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatNumber(totalQuantity)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Batches</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatNumber(productBatches.length)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Nearest Expiry</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {nearestExpiry ? formatDateUTC(nearestExpiry) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {productBatches.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No batches yet"
          description="No batches — receive stock to create batches."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Batches ({productBatches.length})</CardTitle>
          </CardHeader>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Batch Number</TableHeader>
                <TableHeader align="right">Quantity</TableHeader>
                <TableHeader align="right">Purchase Price</TableHeader>
                <TableHeader>Expiry Date</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {productBatches.map((batch) => {
                const status = getBatchStatus(batch.expiryDate);
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatNumber(batch.quantity)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatCurrency(batch.purchasePrice)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateUTC(batch.expiryDate)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </TableCell>
                    <TableCell align="right">
                      <DeleteBatchButton
                        batchId={batch.id}
                        productId={product.id}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent Movements</CardTitle>
          <Link
            href={`/products/${product.id}/movements`}
            className="ml-auto text-sm font-medium text-blue-600 hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <DataTable>
          <TableHead>
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader align="right">Quantity</TableHeader>
              <TableHeader>Batch</TableHeader>
              <TableHeader>User</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {movements.length === 0 ? (
              <TableEmpty colSpan={5}>No stock movements yet.</TableEmpty>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-slate-500">
                    <span title={formatDateTime(movement.createdAt)}>
                      {formatRelativeTime(movement.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <MovementTypeBadge type={movement.type} />
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`font-medium tabular-nums ${
                      movement.quantity > 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {movement.quantity > 0
                      ? `+${formatNumber(movement.quantity)}`
                      : formatNumber(movement.quantity)}
                  </TableCell>
                  <TableCell>{movement.batchNumber ?? "—"}</TableCell>
                  <TableCell>{movement.userName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </DataTable>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <ButtonLink
            variant="secondary"
            href={`/sales/new?product=${product.id}`}
          >
            <Receipt className="size-4" aria-hidden />
            Record Sale
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            href={`/products/${product.id}/adjust`}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Adjust Stock
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            href={`/products/${product.id}/edit`}
          >
            <PackagePlus className="size-4" aria-hidden />
            Add Batch
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            href={`/forecast?product=${product.id}`}
          >
            <TrendingUp className="size-4" aria-hidden />
            Forecast Demand
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}
