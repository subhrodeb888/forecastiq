import Link from "next/link";

import {
  ArrowRight,
  BarChart3,
  IndianRupee,
  Package,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { LowStockTable } from "@/features/reports/components/low-stock-table";
import { MonthlySalesTable } from "@/features/reports/components/monthly-sales-table";
import { ProfitByCategoryTable } from "@/features/reports/components/profit-by-category-table";
import { RevenueChart } from "@/features/reports/components/revenue-chart";
import { TopProductsTable } from "@/features/reports/components/top-products-table";
import {
  buildRevenueChartData,
  getLowStockProducts,
  getMonthlySalesSummary,
  getProfitByCategory,
  getReportsKpis,
  getSlowMovingProducts,
  getTopSellingProducts,
} from "@/features/reports/queries";
import { formatCurrency, formatNumber } from "@/lib/format";

const REPORT_MONTHS = 12;
const TOP_PRODUCTS_LIMIT = 10;
const SLOW_MOVER_WINDOW_DAYS = 90;

export default async function ReportsPage() {
  // Independent aggregates — fetched in parallel over the pooled connection.
  const [
    kpis,
    monthlySummary,
    topProducts,
    lowStockProducts,
    profitByCategory,
    slowMovers,
  ] = await Promise.all([
    getReportsKpis(),
    getMonthlySalesSummary({ months: REPORT_MONTHS }),
    getTopSellingProducts({ limit: TOP_PRODUCTS_LIMIT }),
    getLowStockProducts(),
    getProfitByCategory(),
    getSlowMovingProducts(SLOW_MOVER_WINDOW_DAYS),
  ]);

  const revenueData = buildRevenueChartData(monthlySummary, REPORT_MONTHS);
  const hasAnyData =
    kpis.totalSales > 0 || kpis.totalProducts > 0 || kpis.totalForecasts > 0;
  const hasRevenue = revenueData.some((point) => point.revenue > 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Reports &amp; Analytics</h1>
        <p className="mt-1 text-slate-500">
          Revenue, product, and inventory performance across ForecastIQ.
        </p>
      </header>

      <section
        aria-label="Key performance indicators"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          description="All-time recorded sales"
          icon={IndianRupee}
          accent="emerald"
        />
        <KpiCard
          label="Total Sales"
          value={formatNumber(kpis.totalSales)}
          description="Completed orders"
          icon={Receipt}
          accent="blue"
        />
        <KpiCard
          label="Total Products"
          value={formatNumber(kpis.totalProducts)}
          description="In the catalog"
          icon={Package}
          accent="violet"
        />
        <KpiCard
          label="Total Forecasts"
          value={formatNumber(kpis.totalForecasts)}
          description="Forecasts generated"
          icon={TrendingUp}
          accent="amber"
        />
      </section>

      {!hasAnyData ? (
        <EmptyState
          icon={BarChart3}
          title="No report data yet"
          description="Reports come alive once you add products and record sales. Head to CSV Import or the Sales page to get started."
        />
      ) : (
        <>
          <section
            aria-label={`Monthly revenue, last ${REPORT_MONTHS} months`}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Revenue trend</h2>
              <span className="text-sm text-slate-500">
                Last {REPORT_MONTHS} months
              </span>
            </div>
            {hasRevenue ? (
              <RevenueChart data={revenueData} />
            ) : (
              <p className="flex h-[360px] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                No revenue recorded in the last {REPORT_MONTHS} months.
              </p>
            )}
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <TopProductsTable products={topProducts} />
            <LowStockTable products={lowStockProducts} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <ProfitByCategoryTable rows={profitByCategory} />

            <Card>
              <CardHeader className="justify-between">
                <CardTitle>Slow Movers</CardTitle>
                <Badge tone={slowMovers.length > 0 ? "amber" : "neutral"}>
                  {formatNumber(slowMovers.length)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-500">
                  Products with no sales in the last {SLOW_MOVER_WINDOW_DAYS}{" "}
                  days — capital sitting idle on the shelf.
                </p>
                <Link
                  href="/reports/slow-movers"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  View full report
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <MonthlySalesTable rows={monthlySummary} />
        </>
      )}
    </div>
  );
}
