import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  IndianRupee,
  Package,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import {
  getExpiryAlerts,
  getLowStockProducts,
  getRecentStockMovements,
} from "@/features/inventory/queries";
import type { StockMovement } from "@/features/inventory/types";
import { getPendingPurchaseOrderCount } from "@/features/purchases/queries";
import { getRecentSales, getTodaysSalesSummary } from "@/features/sales/queries";
import { getDashboardStats } from "@/lib/dashboard";
import {
  formatCurrency,
  formatNumber,
  formatRelativeTime,
  humanizeToken,
} from "@/lib/format";

/** Rows shown per activity feed. */
const RECENT_ACTIVITY_LIMIT = 5;

/** Window behind the "Expiring Soon" KPI. */
const EXPIRING_SOON_DAYS = 30;

type KpiAccent = "emerald" | "blue" | "violet" | "amber" | "red";

/** Badge tone per movement type — static map so Tailwind sees every class. */
const movementTones: Record<
  StockMovement["type"],
  "neutral" | "blue" | "emerald" | "amber" | "red" | "violet"
> = {
  sale: "blue",
  purchase: "emerald",
  adjustment: "neutral",
  damage: "red",
  return: "amber",
  expiry: "violet",
};

export default async function DashboardPage() {
  // Independent aggregates and feeds — fetched in parallel over the pooled connection.
  const [
    stats,
    lowStockProducts,
    todaysSales,
    pendingOrderCount,
    expiringBatches,
    recentSales,
    recentMovements,
  ] = await Promise.all([
    getDashboardStats(),
    getLowStockProducts(),
    getTodaysSalesSummary(),
    getPendingPurchaseOrderCount(),
    getExpiryAlerts(EXPIRING_SOON_DAYS),
    getRecentSales(RECENT_ACTIVITY_LIMIT),
    getRecentStockMovements(RECENT_ACTIVITY_LIMIT),
  ]);

  const lowStockCount = lowStockProducts.length;
  // getExpiryAlerts' window has no lower bound, so already-expired batches are
  // included — "next 30 days" only counts stock that can still be sold.
  const expiringSoonCount = expiringBatches.filter(
    (alert) => alert.daysUntilExpiry >= 0,
  ).length;

  const kpis: {
    label: string;
    value: string;
    description: string;
    href: string;
    icon: LucideIcon;
    accent: KpiAccent;
    valueClassName?: string;
  }[] = [
    {
      label: "Total Products",
      value: formatNumber(stats.products),
      description: "Items in the catalog",
      href: "/products",
      icon: Package,
      accent: "blue",
    },
    {
      label: "Low Stock",
      value: formatNumber(lowStockCount),
      description: "At or below reorder point",
      href: "/reorder",
      icon: AlertTriangle,
      accent: lowStockCount > 0 ? "red" : "emerald",
      valueClassName: lowStockCount > 0 ? "text-red-600" : undefined,
    },
    {
      label: "Today's Sales",
      value: formatCurrency(todaysSales.totalRevenue),
      description: `${formatNumber(todaysSales.salesCount)} ${
        todaysSales.salesCount === 1 ? "sale" : "sales"
      } today`,
      href: "/reports",
      icon: IndianRupee,
      accent: "emerald",
    },
    {
      label: "Pending POs",
      value: formatNumber(pendingOrderCount),
      description: "Orders not yet received",
      href: "/purchases?status=ordered",
      icon: ShoppingCart,
      accent: "amber",
    },
    {
      label: "Expiring Soon",
      value: formatNumber(expiringSoonCount),
      description: `Batches expiring within ${EXPIRING_SOON_DAYS} days`,
      href: "/expiry",
      icon: CalendarClock,
      accent: "violet",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Sales, stock, and procurement at a glance."
      />

      {/* KPI row — every card links to the page behind the metric. */}
      <section
        aria-label="Key performance indicators"
        className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      >
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="block">
            <KpiCard
              label={kpi.label}
              value={kpi.value}
              description={kpi.description}
              icon={kpi.icon}
              accent={kpi.accent}
              valueClassName={kpi.valueClassName}
            />
          </Link>
        ))}
      </section>

      {/* Recent activity */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          {recentSales.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No sales recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentSales.map((sale) => (
                <li
                  key={sale.id}
                  className="flex items-center justify-between gap-4 px-6 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      #{sale.id.slice(0, 8)}
                      <span className="ml-2 font-normal text-slate-500">
                        {sale.itemCount}{" "}
                        {sale.itemCount === 1 ? "item" : "items"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRelativeTime(sale.saleDate)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {sale.totalAmountLabel}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Stock Movements</CardTitle>
          </CardHeader>
          {recentMovements.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No stock movements yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMovements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between gap-4 px-6 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {movement.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(movement.quantity)} units ·{" "}
                      {formatRelativeTime(movement.createdAt)}
                    </p>
                  </div>
                  <Badge tone={movementTones[movement.type]}>
                    {humanizeToken(movement.type)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        <p className="text-sm text-slate-500">Jump straight into a task</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/sales/new">
            <Receipt className="size-4" />
            New Sale
          </ButtonLink>
          <ButtonLink href="/purchases/new" variant="secondary">
            <ShoppingCart className="size-4" />
            New Purchase Order
          </ButtonLink>
          <ButtonLink href="/products/new" variant="secondary">
            <Package className="size-4" />
            Add Product
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
