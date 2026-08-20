/** Shared page size for every paginated list view. */
export const PAGE_SIZE = 20;

/** Paginated query result: the current page's rows plus the filtered total. */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
}

/** Total page count for a filtered total — always at least one. */
export function getTotalPages(
  totalCount: number,
  pageSize = PAGE_SIZE,
): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** Parse a ?page= search param into a positive integer, defaulting to 1. */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
