import Link from "next/link";

import { AlertTriangle, Boxes, IndianRupee, PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { toPaise } from "@/features/inventory/money";
import { getExpiryAlerts } from "@/features/inventory/queries";
import type { ExpiryAlert } from "@/features/inventory/types";
import { formatCurrency, formatDateUTC, formatNumber } from "@/lib/format";

interface ExpiryPageProps {
  searchParams: Promise<{ filter?: string | string[] }>;
}

/** The dashboard looks 90 days out — getExpiryAlerts' default window. */
const EXPIRY_WINDOW_DAYS = 90;
const EXPIRING_SOON_DAYS = 30;
const MID_WINDOW_DAYS = 60;

type ExpiryFilter = "expired" | "soon" | "30-60" | "60-90";

const EXPIRY_FILTERS: readonly string[] = ["expired", "soon", "30-60", "60-90"];

const tabs: { label: string; href: string; value?: ExpiryFilter }[] = [
  { label: "All", href: "/expiry" },
  { label: "Expired", href: "/expiry?filter=expired", value: "expired" },
  {
    label: "Expiring Soon (< 30 days)",
    href: "/expiry?filter=soon",
    value: "soon",
  },
  {
    label: "Expiring in 30–60 days",
    href: "/expiry?filter=30-60",
    value: "30-60",
  },
  {
    label: "Expiring in 60–90 days",
    href: "/expiry?filter=60-90",
    value: "60-90",
  },
];

function matchesFilter(alert: ExpiryAlert, filter?: ExpiryFilter): boolean {
  const days = alert.daysUntilExpiry;
  switch (filter) {
    case "expired":
      return days < 0;
    case "soon":
      return days >= 0 && days < EXPIRING_SOON_DAYS;
    case "30-60":
      return days >= EXPIRING_SOON_DAYS && days < MID_WINDOW_DAYS;
    case "60-90":
      return days >= MID_WINDOW_DAYS;
    default:
      return true;
  }
}

/** Urgency bucket behind the Days Left badge. */
function expiryBucket(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) return { label: "Expired", tone: "red" as const };
  if (daysUntilExpiry < EXPIRING_SOON_DAYS) {
    return { label: "Expiring Soon", tone: "amber" as const };
  }
  if (daysUntilExpiry < MID_WINDOW_DAYS) {
    return { label: "30–60 days", tone: "neutral" as const };
  }
  return { label: "60–90 days", tone: "blue" as const };
}

/** Exact-day companion to the bucket badge, e.g. "12d left", "5d overdue". */
function exactDaysLabel(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) return `${-daysUntilExpiry}d overdue`;
  if (daysUntilExpiry === 0) return "expires today";
  return `${daysUntilExpiry}d left`;
}

export default async function ExpiryPage({ searchParams }: ExpiryPageProps) {
  const { filter } = await searchParams;
  const filterParam = Array.isArray(filter) ? filter[0] : filter;

  // Unknown filters fall back to the full window (and the "All" tab).
  const activeFilter = EXPIRY_FILTERS.includes(filterParam ?? "")
    ? (filterParam as ExpiryFilter)
    : undefined;

  // One fetch — the query returns everything in the window, already sorted
  // oldest expiry first (most urgent at the top).
  const alerts = await getExpiryAlerts(EXPIRY_WINDOW_DAYS);
  const filteredAlerts = alerts.filter((alert) =>
    matchesFilter(alert, activeFilter),
  );

  // KPIs always describe the whole 90-day window, not the active tab.
  const totalQuantity = alerts.reduce((sum, alert) => sum + alert.quantity, 0);
  const valueAtRiskPaise = alerts.reduce(
    (sum, alert) => sum + alert.quantity * toPaise(alert.purchasePrice),
    0,
  );
  const expiredCount = alerts.filter(
    (alert) => alert.daysUntilExpiry < 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Management"
        description="Track and act on expiring stock"
      />

      <section
        aria-label="Expiry summary"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Batches Expiring"
          value={formatNumber(alerts.length)}
          description={`Next ${EXPIRY_WINDOW_DAYS} days`}
          icon={Boxes}
          accent="blue"
        />
        <KpiCard
          label="Units at Risk"
          value={formatNumber(totalQuantity)}
          description="Across expiring batches"
          icon={PackageOpen}
          accent="violet"
        />
        <KpiCard
          label="Est. Value at Risk"
          value={formatCurrency(valueAtRiskPaise / 100)}
          description="At purchase price"
          icon={IndianRupee}
          accent="amber"
        />
        <KpiCard
          label="Already Expired"
          value={formatNumber(expiredCount)}
          description="Batches past expiry"
          icon={AlertTriangle}
          accent="red"
        />
      </section>

      {/* Expiry windows — server-side filtering via the ?filter= URL param. */}
      <nav
        aria-label="Filter expiring stock by window"
        className="flex flex-wrap gap-x-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeFilter;
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

      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={
            activeFilter
              ? "Nothing in this window"
              : "No expiring stock in the next 90 days"
          }
          description={
            activeFilter
              ? "Try another expiry window."
              : "Every batch with stock is more than 90 days from expiry."
          }
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Product</TableHeader>
                <TableHeader>Batch Number</TableHeader>
                <TableHeader align="right">Quantity</TableHeader>
                <TableHeader>Expiry Date</TableHeader>
                <TableHeader>Days Left</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {filteredAlerts.map((alert) => {
                const bucket = expiryBucket(alert.daysUntilExpiry);
                // Never nudge a sale of already-expired stock.
                const sellFirst =
                  alert.daysUntilExpiry >= 0 &&
                  alert.daysUntilExpiry < EXPIRING_SOON_DAYS;

                return (
                  <TableRow key={alert.batchId}>
                    <TableCell>
                      <p>
                        <Link
                          href={`/products/${alert.productId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {alert.productName}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-500">{alert.sku}</p>
                    </TableCell>
                    <TableCell className="font-medium">
                      {alert.batchNumber}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatNumber(alert.quantity)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateUTC(alert.expiryDate)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={bucket.tone}>{bucket.label}</Badge>
                      <span className="ml-2 text-xs whitespace-nowrap text-slate-500">
                        {exactDaysLabel(alert.daysUntilExpiry)}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-3">
                        {sellFirst && <Badge tone="violet">Sell First</Badge>}
                        <Link
                          href={`/products/${alert.productId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          View Product
                        </Link>
                      </div>
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
