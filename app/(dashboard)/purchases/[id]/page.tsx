import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseOrderActions } from "@/features/purchases/components/purchase-order-actions";
import { PurchaseStatusBadge } from "@/features/purchases/components/purchase-status-badge";
import { getPurchaseOrderById } from "@/features/purchases/queries";
import { formatDateUTC, formatNumber } from "@/lib/format";

interface PurchaseOrderPageProps {
  params: Promise<{ id: string }>;
}

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PurchaseOrderPage({
  params,
}: PurchaseOrderPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const order = await getPurchaseOrderById(id);
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Purchase Order #${order.id.slice(0, 8)}`}
        description={`${order.supplierName ?? "No supplier"} · ordered ${formatDateUTC(order.purchaseDate)}`}
      >
        <PurchaseOrderActions orderId={order.id} status={order.status} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Order details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">Supplier</dt>
              <dd className="mt-1 text-slate-900">
                {order.supplierName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Status</dt>
              <dd className="mt-1">
                <PurchaseStatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Purchase Date</dt>
              <dd className="mt-1 text-slate-900">
                {formatDateUTC(order.purchaseDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Delivery Date</dt>
              <dd className="mt-1 text-slate-900">
                {order.deliveryDate
                  ? formatDateUTC(order.deliveryDate)
                  : "Not scheduled"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Total Amount</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {order.totalAmountLabel}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Notes</dt>
              <dd className="mt-1 text-slate-900">{order.notes ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Items ({order.items.length})</CardTitle>
        </CardHeader>
        <DataTable>
          <TableHead>
            <tr>
              <TableHeader>Product</TableHeader>
              <TableHeader>SKU</TableHeader>
              <TableHeader align="right">Qty Ordered</TableHeader>
              <TableHeader align="right">Purchase Price</TableHeader>
              <TableHeader align="right">Line Total</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.productName}
                </TableCell>
                <TableCell className="text-slate-500">
                  {item.productSku}
                </TableCell>
                <TableCell align="right" className="tabular-nums">
                  {formatNumber(item.quantity)}
                </TableCell>
                <TableCell align="right" className="tabular-nums">
                  {item.purchasePriceLabel}
                </TableCell>
                <TableCell align="right" className="tabular-nums">
                  {item.lineTotalLabel}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </Card>
    </div>
  );
}
