/**
 * Item arrays arrive as indexed FormData fields — `items[0][productId]`,
 * `items[0][quantity]`, … — because FormData is flat key/value. Reassembles
 * them into plain objects (ordered by index) for Zod to validate; keys that
 * do not match the indexed pattern are ignored.
 */
export function parseIndexedItems(
  formData: FormData,
  prefix: string,
): Record<string, FormDataEntryValue>[] {
  const pattern = new RegExp(`^${prefix}\\[(\\d+)]\\[(\\w+)]$`);
  const rows = new Map<number, Record<string, FormDataEntryValue>>();

  for (const [key, value] of formData.entries()) {
    const match = pattern.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    row[match[2]] = value;
    rows.set(index, row);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);
}
