export default function ReportsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-72 rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
      </div>

      {/* KPI cards */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-start justify-between rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="space-y-3">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-7 w-32 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-100" />
            </div>
            <div className="size-11 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-[360px] rounded-lg bg-slate-100" />
      </div>

      {/* Two-column tables */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {[0, 1].map((section) => (
          <div
            key={section}
            className="overflow-hidden rounded-xl border bg-white shadow-sm"
          >
            <div className="border-b px-4 py-4">
              <div className="h-5 w-44 rounded bg-slate-200" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, row) => (
                <div key={row} className="h-9 rounded bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly sales table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="h-5 w-40 rounded bg-slate-200" />
        </div>
        <div className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="h-9 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
