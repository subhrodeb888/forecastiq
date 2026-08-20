"use client";

import { useTransition } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatNumber } from "@/lib/format";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** Path the page buttons navigate to — existing query params are preserved. */
  basePath: string;
}

/**
 * Window of page numbers to render: the first and last page are always
 * visible, the current page keeps one neighbor on each side, and gaps
 * collapse into an ellipsis. Never more than five page numbers — small page
 * counts render in full.
 */
function getPageItems(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 2) {
    return [1, 2, 3, "ellipsis", totalPages];
  }
  if (currentPage >= totalPages - 1) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }
  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

const pageButtonClass = (isActive: boolean) =>
  `inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors ${
    isActive
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`;

const navButtonClass =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white";

/**
 * URL-driven pagination footer for tables. Page state lives in the ?page=
 * query param so every page is shareable and server-rendered; other params
 * (e.g. ?status=) are preserved across navigation.
 *
 * Renders nothing when there is at most one page. Because it reads
 * useSearchParams, host pages are expected to render dynamically (every
 * table page reads its own searchParams server-side, so that holds).
 */
export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  basePath,
}: TablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // True while the next page's server render is in flight — the bar dims.
  const [isPending, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  // A stale ?page= beyond the range would otherwise render no active button.
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    // Page 1 is the default view — keep the URL clean.
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath);
    });
  }

  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-col gap-3 transition-opacity sm:flex-row sm:items-center sm:justify-between ${
        isPending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <p className="text-sm text-slate-500 tabular-nums">
        Showing {formatNumber(start)}–{formatNumber(end)} of{" "}
        {formatNumber(totalItems)} items
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Go to previous page"
          className={navButtonClass}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </button>

        {getPageItems(safePage, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden
              className="inline-flex size-9 items-center justify-center text-sm text-slate-400"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goToPage(item)}
              aria-label={`Go to page ${item}`}
              aria-current={item === safePage ? "page" : undefined}
              className={pageButtonClass(item === safePage)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => goToPage(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Go to next page"
          className={navButtonClass}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
