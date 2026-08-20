"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Bell } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const pageName =
    pathname === "/dashboard"
      ? "Dashboard"
      : (pathname
          .split("/")[1]
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()) ?? "ForecastIQ");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Page title */}
      <h1 className="text-xl font-semibold text-slate-900">{pageName}</h1>

      {/* Mobile brand — only visible below md breakpoint */}
      <Link
        href="/dashboard"
        className="mr-auto flex items-center gap-2 text-lg font-bold text-slate-900 md:hidden"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
          <TrendingUp className="size-4" />
        </span>
        ForecastIQ
      </Link>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          U
        </div>
      </div>
    </header>
  );
}
