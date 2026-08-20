/**
 * Money math in integer paise. Binary floats cannot represent most decimal
 * prices exactly (0.1 + 0.2 !== 0.3), so totals are summed as integer paise
 * and only converted back to a decimal string at persistence time.
 */

/** Convert a validated (≤ 2 decimal places) amount to integer paise. */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** Format integer paise as the string Postgres expects for numeric(10,2). */
export function paiseToMoney(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** Server-authoritative order total: sum of quantity × unitPrice, in paise. */
export function itemsTotalPaise(
  items: readonly { quantity: number; unitPrice: number }[],
): number {
  return items.reduce((sum, item) => sum + item.quantity * toPaise(item.unitPrice), 0);
}

/** Server-authoritative order total as a numeric(10,2) string. */
export function itemsTotalMoney(
  items: readonly { quantity: number; unitPrice: number }[],
): string {
  return paiseToMoney(itemsTotalPaise(items));
}
