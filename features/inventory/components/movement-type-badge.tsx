import { Badge } from "@/components/ui/badge";
import { humanizeToken } from "@/lib/format";

import type { StockMovement } from "../types";

/** Movement type → Badge tone: stock in is emerald, a sale is blue. */
const movementTones = {
  sale: "blue",
  purchase: "emerald",
  adjustment: "neutral",
  damage: "red",
  return: "amber",
  expiry: "violet",
} as const;

/** Pill showing a stock movement's type. */
export function MovementTypeBadge({ type }: { type: StockMovement["type"] }) {
  return <Badge tone={movementTones[type]}>{humanizeToken(type)}</Badge>;
}
