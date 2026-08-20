"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDateUTC, formatShortDateUTC } from "@/lib/format";

import type { StoredForecastPoint } from "../types";

interface ChartDatum {
  /** Short axis label, e.g. "12 Aug". */
  date: string;
  /** Full date shown in the tooltip heading. */
  fullDate: string;
  predicted: number;
  lower: number | null;
  upper: number | null;
  /** [lower, upper] pair rendered as the shaded confidence band. */
  band: [number, number] | null;
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: ChartDatum;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = payload[0]?.payload?.fullDate;
  const entries = payload.filter((entry) => entry.dataKey !== "band");
  const order = ["predicted", "lower", "upper"];
  entries.sort(
    (a, b) => order.indexOf(String(a.dataKey)) - order.indexOf(String(b.dataKey)),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="mb-1.5 font-medium text-slate-900">{heading}</p>
      <div className="space-y-1">
        {entries.map((entry) => (
          <p key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-500">{entry.name}</span>
            <span className="ml-auto pl-4 font-medium text-slate-900 tabular-nums">
              {entry.value}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Responsive forecast chart: predicted demand line with the lower/upper
 * confidence bounds (dashed) and a shaded band between them.
 */
export function ForecastChart({ points }: { points: StoredForecastPoint[] }) {
  const hasIntervals = points.some(
    (point) => point.lowerBound !== null && point.upperBound !== null,
  );

  const data: ChartDatum[] = points.map((point) => ({
    date: formatShortDateUTC(point.date),
    fullDate: formatDateUTC(point.date),
    predicted: point.predictedDemand,
    lower: point.lowerBound,
    upper: point.upperBound,
    band:
      point.lowerBound !== null && point.upperBound !== null
        ? [point.lowerBound, point.upperBound]
        : null,
  }));

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />

          {hasIntervals && (
            <Area
              dataKey="band"
              name="Confidence band"
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.12}
              connectNulls
              isAnimationActive={false}
              legendType="none"
            />
          )}
          {hasIntervals && (
            <Line
              type="monotone"
              dataKey="upper"
              name="Upper bound"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {hasIntervals && (
            <Line
              type="monotone"
              dataKey="lower"
              name="Lower bound"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted demand"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
