import { z } from "zod";

/**
 * Bounds for the reusable reports query layer. Every query helper parses its
 * options through this schema so out-of-range values can never reach the
 * database, regardless of which caller passes them.
 */
export const reportQueryOptionsSchema = z.object({
  /** Trailing calendar months (including the current one) a report covers. */
  months: z
    .number()
    .int("Months must be a whole number.")
    .min(1, "Months must be at least 1.")
    .max(36, "Months cannot exceed 36.")
    .default(12),

  /** Maximum rows returned by ranked reports. */
  limit: z
    .number()
    .int("Limit must be a whole number.")
    .min(1, "Limit must be at least 1.")
    .max(50, "Limit cannot exceed 50.")
    .default(10),
});

export type ReportQueryOptionsInput = z.input<typeof reportQueryOptionsSchema>;
