"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertCircle, Plus, Trash2 } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSale } from "../actions";
import type { SaleActionResult, SaleProductOption } from "../types";

interface SaleFormProps {
  products: SaleProductOption[];
  /** Preselected via /sales/new?product=<id> (e.g. from the product page). */
  preselectedProductId?: string;
  /** YYYY-MM-DD for the date input default, computed on the server. */
  todayIso: string;
}

interface ItemRow {
  key: number;
  productId: string;
}

const selectClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50";

/**
 * Sale entry form: dynamic product/quantity rows serialized as indexed
 * `items[i][field]` FormData fields. Batch selection is not shown — the
 * server allocates FEFO (oldest expiry first) when the sale is recorded.
 */
export function SaleForm({
  products,
  preselectedProductId,
  todayIso,
}: SaleFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: SaleActionResult | null, formData: FormData) =>
      createSale(formData),
    null,
  );

  const [rows, setRows] = useState<ItemRow[]>(() => [
    { key: 0, productId: preselectedProductId ?? "" },
  ]);
  const nextRowKey = useRef(1);

  // A recorded sale revalidates the list — send the user to it.
  useEffect(() => {
    if (state?.ok) {
      router.push("/sales");
    }
  }, [state, router]);

  const addRow = () => {
    const key = nextRowKey.current++;
    setRows((current) => [...current, { key, productId: "" }]);
  };
  const removeRow = (key: number) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };
  const setProduct = (key: number, productId: string) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, productId } : row)),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>
              Batches are picked automatically, oldest expiry first (FEFO).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end"
            >
              <div>
                <Label htmlFor={`items-${index}-productId`} required>
                  Product
                </Label>
                <select
                  id={`items-${index}-productId`}
                  name={`items[${index}][productId]`}
                  value={row.productId}
                  onChange={(event) => setProduct(row.key, event.target.value)}
                  required
                  disabled={isPending}
                  className={selectClasses}
                >
                  <option value="" disabled>
                    Select a product
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`items-${index}-quantity`} required>
                  Quantity
                </Label>
                <Input
                  id={`items-${index}-quantity`}
                  name={`items[${index}][quantity]`}
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={1}
                  required
                  disabled={isPending}
                />
              </div>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={isPending}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              )}
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addRow}
              disabled={isPending}
            >
              <Plus className="size-4" aria-hidden />
              Add Item
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Sale details</CardTitle>
            <CardDescription>
              Defaults to today — backdate only if you must.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div>
            <Label htmlFor="saleDate">Sale Date</Label>
            <Input
              id="saleDate"
              name="saleDate"
              type="date"
              defaultValue={todayIso}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional note for this sale"
              disabled={isPending}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
        </CardContent>
      </Card>

      {state && !state.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{state.error.message}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <ButtonLink variant="secondary" href="/sales">
          Cancel
        </ButtonLink>
        <Button type="submit" isLoading={isPending}>
          Record Sale
        </Button>
      </div>
    </form>
  );
}
