import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, History } from "lucide-react";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MovementTypeBadge } from "@/features/inventory/components/movement-type-badge";
import { getStockMovements } from "@/features/inventory/queries";
import type { StockMovementWithDetails } from "@/features/inventory/types";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format";

interface StockHistoryPageProps {
  params: Promise<{ id: string }>;
}

const MOVEMENTS_LIMIT = 100;

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a movement's referenceId points, when it points anywhere. */
function referenceLink(movement: StockMovementWithDetails) {
  if (!movement.referenceId) return null;
  const short = movement.referenceId.slice(0, 8);
  if (movement.type === "purchase") {
    return {
      href: `/purchases/${movement.referenceId}`,
      label: `PO #${short}`,
    };
  }
  if (movement.type === "sale") {
    return {
      href: `/sales/${movement.referenceId}`,
      label: `Sale #${short}`,
    };
  }
  return null;
}

export default async function StockHistoryPage({
  params,
}: StockHistoryPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  // Independent reads — fetched in parallel over the pooled connection.
  const [result, movements] = await Promise.all([
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, id))
      .limit(1),
    getStockMovements(id, MOVEMENTS_LIMIT),
  ]);

  const product = result[0];
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Stock History" description={product.name}>
        <ButtonLink variant="secondary" href={`/products/${product.id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to Product
        </ButtonLink>
      </PageHeader>

      {movements.length === 0 ? (
        <EmptyState
          icon={History}
          title="No stock movements recorded"
          description="Receipts, sales and adjustments for this product will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Movements</CardTitle>
            <span className="ml-auto text-sm whitespace-nowrap text-slate-500">
              Latest {MOVEMENTS_LIMIT}
            </span>
          </CardHeader>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Date</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader align="right">Quantity</TableHeader>
                <TableHeader>Batch</TableHeader>
                <TableHeader>Reference</TableHeader>
                <TableHeader>User</TableHeader>
                <TableHeader>Notes</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {movements.map((movement) => {
                const reference = referenceLink(movement);
                return (
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
                    <TableCell>
                      {reference ? (
                        <Link
                          href={reference.href}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {reference.label}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{movement.userName}</TableCell>
                    <TableCell className="max-w-56">
                      {movement.notes ? (
                        <span
                          className="block truncate text-slate-500"
                          title={movement.notes}
                        >
                          {movement.notes}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </Card>
      )}
    </div>
  );
}
