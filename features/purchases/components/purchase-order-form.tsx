"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertCircle, Plus, Trash2 } from "lucide-react";

import { ProductCombobox } from "@/components/product-combobox";
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
import { toPaise } from "@/features/inventory/money";
import type { SupplierOption } from "@/features/suppliers/types";
import { formatCurrency } from "@/lib/format";

import { createPurchaseOrder } from "../actions";
import type { PurchaseProductOption } from "../types";

interface PurchaseOrderFormProps {
  products: PurchaseProductOption[];
  suppliers: SupplierOption[];
  /** First-row prefill via /purchases/new?product=<id>&quantity=<n>. */
  prefill?: { productId: string; quantity?: number };
}

interface ItemRow {
  key: number;
  productId: string;
  quantity: string;
  purchasePrice: string;
}

const selectClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50";

const textareaClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50";

/** Display-only line total in whole rupees; null when the row isn't priced. */
function lineTotalRupees(row: ItemRow): number | null {
  const quantity = Number(row.quantity);
  const price = Number(row.purchasePrice);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  // Integer-paise math, same as the server's authoritative total.
  return (toPaise(price) * quantity) / 100;
}

/**
 * Purchase order entry form: dynamic product/quantity/price rows serialized
 * as indexed `items[i][field]` FormData fields. Totals shown here are
 * indicative — the server recomputes them when the order is created.
 */
export function PurchaseOrderForm({
  products,
  suppliers,
  prefill,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createPurchaseOrder,
    { success: false, errors: {} },
  );

  // The action returns the new order id instead of redirecting — navigate
  // client-side so the success data is available here.
  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/purchases/${state.data.id}`);
    }
  }, [state.success, state.data, router]);

  /** First message for a field, or undefined so the input renders clean. */
  const fieldError = (key: string) => state.errors[key]?.[0];
  const formError = state.errors["form"]?.[0];

  const [rows, setRows] = useState<ItemRow[]>(() => [
    {
      key: 0,
      productId: prefill?.productId ?? "",
      quantity: prefill?.quantity?.toString() ?? "",
      purchasePrice: "",
    },
  ]);
  const nextRowKey = useRef(1);

  const addRow = () => {
    const key = nextRowKey.current++;
    setRows((current) => [
      ...current,
      { key, productId: "", quantity: "", purchasePrice: "" },
    ]);
  };
  const removeRow = (key: number) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };
  const updateRow = (key: number, patch: Partial<Omit<ItemRow, "key">>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const grandTotalPaise = rows.reduce((sum, row) => {
    const quantity = Number(row.quantity);
    const price = Number(row.purchasePrice);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return sum;
    }
    return sum + toPaise(price) * quantity;
  }, 0);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>
              Line totals are indicative — the server computes the order total.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => {
            const selectedProduct =
              products.find((product) => product.id === row.productId) ?? null;
            const lineTotal = lineTotalRupees(row);

            return (
              <div
                key={row.key}
                className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_110px_150px_110px_auto] lg:items-end"
              >
                <div>
                  <Label>Product</Label>
                  <ProductCombobox
                    products={products}
                    value={selectedProduct}
                    onChange={(product) =>
                      updateRow(row.key, { productId: product.id })
                    }
                    disabled={isPending}
                  />
                  {/* The combobox is a widget, not an input — carry the value explicitly. */}
                  <input
                    type="hidden"
                    name={`items[${index}][productId]`}
                    value={row.productId}
                  />
                  {fieldError(`items-${index}-productId`) && (
                    <p className="mt-1.5 text-xs text-red-600">
                      {fieldError(`items-${index}-productId`)}
                    </p>
                  )}
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
                    placeholder="0"
                    required
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.key, { quantity: event.target.value })
                    }
                    error={fieldError(`items-${index}-quantity`)}
                    disabled={isPending}
                  />
                </div>
                <div>
                  <Label htmlFor={`items-${index}-purchasePrice`} required>
                    Unit Price (₹)
                  </Label>
                  <Input
                    id={`items-${index}-purchasePrice`}
                    name={`items[${index}][purchasePrice]`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                    value={row.purchasePrice}
                    onChange={(event) =>
                      updateRow(row.key, { purchasePrice: event.target.value })
                    }
                    error={fieldError(`items-${index}-purchasePrice`)}
                    disabled={isPending}
                  />
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-slate-400">
                      Sells at {formatCurrency(selectedProduct.sellingPrice)}
                    </p>
                  )}
                </div>
                <div>
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Line Total
                  </span>
                  <p className="py-2.5 text-sm font-medium tabular-nums text-slate-900">
                    {lineTotal === null ? "—" : formatCurrency(lineTotal)}
                  </p>
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
            );
          })}

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
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
            <p className="text-sm text-slate-500">
              Order Total
              <span className="ml-2 text-lg font-semibold tabular-nums text-slate-900">
                {formatCurrency(grandTotalPaise / 100)}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Order details</CardTitle>
            <CardDescription>
              Draft orders can be placed later; ordered ones go straight to the
              supplier.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <Label htmlFor="supplierId">Supplier</Label>
              <select
                id="supplierId"
                name="supplierId"
                defaultValue=""
                disabled={isPending}
                aria-invalid={fieldError("supplierId") ? true : undefined}
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 ${
                  fieldError("supplierId")
                    ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300"
                }`}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {fieldError("supplierId") && (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldError("supplierId")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="deliveryDate">Expected Delivery</Label>
              <Input
                id="deliveryDate"
                name="deliveryDate"
                type="date"
                error={fieldError("deliveryDate")}
                disabled={isPending}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="draft"
                disabled={isPending}
                className={selectClasses}
              >
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional note for this order"
              disabled={isPending}
              className={textareaClasses}
            />
          </div>
        </CardContent>
      </Card>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <ButtonLink variant="secondary" href="/purchases">
          Cancel
        </ButtonLink>
        <Button type="submit" isLoading={isPending} disabled={isPending}>
          {isPending ? "Creating..." : "Create Purchase Order"}
        </Button>
      </div>
    </form>
  );
}
