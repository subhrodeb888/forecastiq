import { Badge } from "@/components/ui/badge";
import { humanizeToken } from "@/lib/format";

import type { PurchaseStatus } from "../types";

/** Status → Badge tone, following the order lifecycle (draft → received). */
const statusTones = {
  draft: "neutral",
  ordered: "blue",
  partially_received: "amber",
  received: "emerald",
  cancelled: "red",
} as const;

/** Pill showing a purchase order's lifecycle status. */
export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={statusTones[status]}>{humanizeToken(status)}</Badge>;
}
