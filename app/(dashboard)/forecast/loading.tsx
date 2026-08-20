export default function ForecastLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
      </div>

      {/* Controls */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="h-11 rounded-lg bg-slate-200" />
          <div className="h-11 rounded-lg bg-slate-200" />
          <div className="h-11 w-40 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
        <div className="h-[360px] rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
