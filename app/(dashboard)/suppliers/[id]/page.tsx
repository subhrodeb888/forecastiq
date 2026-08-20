import Link from "next/link";
import { notFound } from "next/navigation";

import { IndianRupee, Package, ShoppingCart, Truck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { PurchaseStatusBadge } from "@/features/purchases/components/purchase-status-badge";
import { getSupplierSummary } from "@/features/purchases/queries";
import {
  getActivePurchaseOrderCount,
  getRecentPurchaseOrders,
  getSupplierById,
} from "@/features/suppliers/queries";
import { formatDateUTC, formatNumber } from "@/lib/format";

interface SupplierPageProps {
  params: Promise<{ id: string }>;
}

const RECENT_ORDERS_LIMIT = 10;

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SupplierPage({ params }: SupplierPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  // Independent reads — fetched in parallel over the pooled connection.
  const [supplier, summary, activeOrders, recentOrders] = await Promise.all([
    getSupplierById(id),
    getSupplierSummary(id),
    getActivePurchaseOrderCount(id),
    getRecentPurchaseOrders(id, RECENT_ORDERS_LIMIT),
  ]);

  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} />

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Contact Person</dt>
              <dd className="mt-1 text-slate-900">
                {supplier.contactPerson ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="mt-1">
                {supplier.email ? (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {supplier.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Phone</dt>
              <dd className="mt-1">
                {supplier.phone ? (
                  <a
                    href={`tel:${supplier.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {supplier.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Address</dt>
              <dd className="mt-1 whitespace-pre-line text-slate-900">
                {supplier.address ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section
        aria-label="Supplier statistics"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Total Orders"
          value={formatNumber(summary.totalOrders)}
          description="Non-cancelled orders"
          icon={ShoppingCart}
          accent="blue"
        />
        <KpiCard
          label="Total Spend"
          value={summary.totalSpendLabel}
          description="Across all orders"
          icon={IndianRupee}
          accent="emerald"
        />
        <KpiCard
          label="Avg Delivery Days"
          value={
            summary.averageDeliveryDays === null
              ? "—"
              : summary.averageDeliveryDays.toFixed(1)
          }
          description="Purchase date to delivery"
          icon={Truck}
          accent="amber"
        />
        <KpiCard
          label="Active POs"
          value={formatNumber(activeOrders)}
          description="Ordered or partially received"
          icon={Package}
          accent="violet"
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent purchase orders</CardTitle>
        </CardHeader>
        <DataTable>
          <TableHead>
            <tr>
              <TableHeader>PO #</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader align="right">Total</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {recentOrders.length === 0 ? (
              <TableEmpty colSpan={4}>
                No purchase orders yet for this supplier.
              </TableEmpty>
            ) : (
              recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/purchases/${order.id}`}
                      title={order.id}
                      className="text-blue-600 hover:underline"
                    >
                      #{order.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateUTC(order.purchaseDate)}
                  </TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {order.totalAmountLabel}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </DataTable>
      </Card>
    </div>
  );
}
