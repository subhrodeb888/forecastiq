/**
 * Shared formatting helpers. Pure functions — safe to use in both server and
 * client components.
 */

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Date-only values (e.g. forecast dates) are stored as UTC midnight, so they
 * must always be rendered in UTC to avoid off-by-one day shifts.
 */
export function formatDateUTC(date: Date): string {
  return dateFormatter.format(date);
}

/** Compact UTC date label for chart axes, e.g. "12 Aug". */
export function formatShortDateUTC(date: Date): string {
  return shortDateFormatter.format(date);
}

/** Absolute timestamp rendered in the server's local timezone. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** Grouped number label, e.g. "1,23,457". */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Whole-rupee currency label, e.g. "₹1,23,457". */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Compact currency label for chart axes, e.g. "₹1.2L". */
export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

/** UTC month-bucket label, e.g. "Aug 2025". */
export function formatMonthUTC(date: Date): string {
  return monthFormatter.format(date);
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-IN", {
  numeric: "auto",
});

/** Relative time label, e.g. "2 days ago", "yesterday", "just now". */
export function formatRelativeTime(date: Date): string {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (absSeconds >= seconds) {
      return relativeTimeFormatter.format(
        Math.round(diffSeconds / seconds),
        unit,
      );
    }
  }

  return "just now";
}

/** "holt_winters" → "Holt Winters". */
export function humanizeToken(token: string): string {
  return token
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
