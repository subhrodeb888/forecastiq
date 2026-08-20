import { History } from "lucide-react";

import { formatDateTime, humanizeToken } from "@/lib/format";

import type { ForecastRunSummary } from "../types";

function confidenceTone(score: number): string {
  if (score >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 60) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

/** Previous forecast runs for the selected product, newest first. */
export function ForecastHistory({ runs }: { runs: ForecastRunSummary[] }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b px-6 py-4">
        <History className="size-4 text-slate-400" />
        <h2 className="text-lg font-semibold">Forecast history</h2>
      </header>

      {runs.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          No forecast runs yet. Generated forecasts will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {runs.map((run) => (
            <li
              key={run.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-4 text-sm"
            >
              <span className="font-medium whitespace-nowrap text-slate-900">
                {formatDateTime(run.generatedAt)}
              </span>
              <span className="text-slate-600">{humanizeToken(run.model)}</span>
              <span className="text-slate-500">{run.horizonDays}-day horizon</span>
              <span
                className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${confidenceTone(run.confidenceScore)}`}
              >
                {Math.round(run.confidenceScore)}% confidence
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
