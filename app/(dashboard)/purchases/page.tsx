import Link from "next/link";

import { ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TablePagination } from "@/components/ui/pagination";
import {
  DataTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseStatusBadge } from "@/features/purchases/components/purchase-status-badge";
import { getPurchaseOrders } from "@/features/purchases/queries";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
} from "@/features/purchases/types";
import { formatDateUTC, humanizeToken } from "@/lib/format";
import {
  PAGE_SIZE,
  getTotalPages,
  parsePageParam,
} from "@/lib/pagination";

interface PurchasesPageProps {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
  const { status, page } = await searchParams;
  const statusParam = Array.isArray(status) ? status[0] : status;

  // Unknown statuses fall back to the unfiltered list (and the "All" tab).
  const activeStatus: PurchaseStatus | undefined = (
    PURCHASE_STATUSES as readonly string[]
  ).includes(statusParam ?? "")
    ? (statusParam as PurchaseStatus)
    : undefined;

  const requestedPage = parsePageParam(page);
  const { items: orders, totalCount } = await getPurchaseOrders(
    activeStatus,
    requestedPage,
    PAGE_SIZE,
  );
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const currentPage = Math.min(requestedPage, totalPages);

  const tabs: { label: string; href: string; value?: PurchaseStatus }[] = [
    { label: "All", href: "/purchases" },
    ...PURCHASE_STATUSES.map((value) => ({
      label: humanizeToken(value),
      href: `/purchases?status=${value}`,
      value,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" description="Manage procurement">
        <ButtonLink href="/purchases/new">New Order</ButtonLink>
      </PageHeader>

      {/* Status filters — server-side filtering via the ?status= URL param. */}
      <nav
        aria-label="Filter purchase orders by status"
        className="flex flex-wrap gap-x-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeStatus;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={
            activeStatus
              ? `No ${humanizeToken(activeStatus).toLowerCase()} orders`
              : "No purchase orders yet"
          }
          description={
            activeStatus
              ? "Try another status filter, or create a new order."
              : "Create your first purchase order to start tracking procurement."
          }
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>PO #</TableHeader>
                <TableHeader>Supplier</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Delivery Date</TableHeader>
                <TableHeader align="right">Total Amount</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
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
                  <TableCell>{order.supplierName ?? "—"}</TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {order.deliveryDate
                      ? formatDateUTC(order.deliveryDate)
                      : "—"}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {order.totalAmountLabel}
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      href={`/purchases/${order.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableContainer>
      )}

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/purchases"
      />
    </div>
  );
}
