import type { LucideIcon } from "lucide-react";

/**
 * Static class map — Tailwind only compiles classes it can see literally, so
 * accent colors are never interpolated at runtime.
 */
const iconAccents = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
} as const;

interface KpiCardProps {
  label: string;
  /** Preformatted display value (currency/number formatting stays in the caller). */
  value: string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof iconAccents;
  /** Extra classes for the value, e.g. text-red-600 for alert states. */
  valueClassName?: string;
}

/** Headline metric card for dashboard stat grids. */
export function KpiCard({ label, value, description, icon: Icon, accent, valueClassName }: KpiCardProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-white p-6 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p
          className={`mt-2 truncate text-2xl font-bold tabular-nums xl:text-3xl ${valueClassName || ""}`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconAccents[accent]}`}
      >
        <Icon className="size-5" aria-hidden />
      </div>
    </div>
  );
}
