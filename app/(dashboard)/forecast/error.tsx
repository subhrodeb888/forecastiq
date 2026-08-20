"use client";

import { useEffect } from "react";

import { AlertTriangle } from "lucide-react";

interface ForecastErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ForecastError({ error, reset }: ForecastErrorProps) {
  useEffect(() => {
    console.error("forecast page failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="size-6 text-red-500" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        The forecast workspace could not be loaded. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
