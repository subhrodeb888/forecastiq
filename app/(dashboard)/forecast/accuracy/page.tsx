import Link from "next/link";

import { ArrowLeft, Target } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
import { getForecastAccuracy } from "@/features/forecast/queries";
import type { ForecastAccuracyStatus } from "@/features/forecast/types";
import { formatNumber, humanizeToken } from "@/lib/format";

/** Models that can be filtered on — the ML service's statistical models. */
const MODEL_FILTERS = ["holt_winters", "linear_trend", "moving_average"] as const;

type ModelFilter = (typeof MODEL_FILTERS)[number];

const statusStyles: Record<
  ForecastAccuracyStatus,
  { label: string; tone: "emerald" | "amber" | "red" }
> = {
  good: { label: "Good", tone: "emerald" },
  acceptable: { label: "Acceptable", tone: "amber" },
  poor: { label: "Poor", tone: "red" },
};

/** Signed percentage label, e.g. "+4.5%" (over-forecast) or "-2.1%". */
function formatBias(bias: number): string {
  return `${bias > 0 ? "+" : ""}${formatNumber(bias)}%`;
}

interface ForecastAccuracyPageProps {
  searchParams: Promise<{ model?: string | string[] }>;
}

export default async function ForecastAccuracyPage({
  searchParams,
}: ForecastAccuracyPageProps) {
  const { model } = await searchParams;
  const modelParam = Array.isArray(model) ? model[0] : model;

  // Unknown models fall back to the unfiltered list (and the "All" tab).
  const activeModel: ModelFilter | undefined = (
    MODEL_FILTERS as readonly string[]
  ).includes(modelParam ?? "")
    ? (modelParam as ModelFilter)
    : undefined;

  const rows = await getForecastAccuracy();
  const filteredRows = activeModel
    ? rows.filter((row) => row.model === activeModel)
    : rows;

  const tabs: { label: string; href: string; value?: ModelFilter }[] = [
    { label: "All", href: "/forecast/accuracy" },
    ...MODEL_FILTERS.map((value) => ({
      label: humanizeToken(value),
      href: `/forecast/accuracy?model=${value}`,
      value,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecast Accuracy"
        description="How past forecast runs measured up against actual sales."
      >
        <ButtonLink href="/forecast" variant="secondary">
          <ArrowLeft className="size-4" />
          Back to Forecasts
        </ButtonLink>
      </PageHeader>

      {/* Model filter — server-side filtering via the ?model= URL param. */}
      <nav
        aria-label="Filter forecast runs by model"
        className="flex flex-wrap gap-x-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeModel;
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

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            activeModel
              ? `No ${humanizeToken(activeModel).toLowerCase()} runs scored yet`
              : "No forecast runs to score yet"
          }
          description={
            activeModel
              ? "Try another model filter."
              : "Accuracy metrics appear once a forecast's horizon has passed and actual sales exist for those days."
          }
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Product</TableHeader>
                <TableHeader>Model Used</TableHeader>
                <TableHeader align="right">Horizon</TableHeader>
                <TableHeader align="right">MAPE</TableHeader>
                <TableHeader align="right">RMSE</TableHeader>
                <TableHeader align="right">Bias</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => {
                const status = statusStyles[row.status];
                return (
                  <TableRow key={row.runId}>
                    <TableCell>
                      <Link
                        href={`/forecast?product=${row.productId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {row.productName}
                      </Link>
                    </TableCell>
                    <TableCell>{humanizeToken(row.model)}</TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {row.horizonDays}d
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatNumber(row.mape)}%
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatNumber(row.rmse)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatBias(row.bias)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={status.tone}>{status.label}</Badge>
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
