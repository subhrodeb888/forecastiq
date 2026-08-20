"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactCurrency, formatCurrency } from "@/lib/format";

import type { RevenueChartPoint } from "../types";

interface TooltipEntry {
  value?: number | string;
  payload?: RevenueChartPoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="mb-1.5 font-medium text-slate-900">{point.month}</p>
      <p className="flex items-center gap-2">
        <span className="inline-block size-2 rounded-full bg-blue-600" />
        <span className="text-slate-500">Revenue</span>
        <span className="ml-auto pl-4 font-medium text-slate-900 tabular-nums">
          {formatCurrency(point.revenue)}
        </span>
      </p>
    </div>
  );
}

/**
 * Monthly revenue line chart. Layout matches the forecast chart: fixed-height
 * responsive container, dashed horizontal grid, compact currency axis.
 */
export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  return (
    <div className="h-[360px] w-full" role="img" aria-label="Monthly revenue line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
          />

          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
