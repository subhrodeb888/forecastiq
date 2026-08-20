"use client";

import { useEffect } from "react";

import { AlertTriangle } from "lucide-react";

interface ReportsErrorProps {
  error: Error & { digest?: string };
  /**
   * Next.js 16.2+ recovery prop — re-fetches and re-renders the segment,
   * unlike the legacy `reset` which only re-renders without re-fetching.
   */
  unstable_retry: () => void;
}

export default function ReportsError({ error, unstable_retry }: ReportsErrorProps) {
  useEffect(() => {
    console.error("reports page failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="size-6 text-red-500" aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        The reports dashboard could not be loaded. Please try again.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
      <button
        onClick={() => unstable_retry()}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
