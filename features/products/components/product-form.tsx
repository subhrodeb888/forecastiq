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
import type { Batch } from "@/features/inventory/types";
import { formatCurrency, formatDateUTC, formatNumber } from "@/lib/format";

import type {
  CategoryOption,
  ProductFormState,
  ProductFormValues,
} from "../types";

interface ProductFormProps {
  categories: CategoryOption[];
  action: (
    state: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  cancelHref: string;
  product?: ProductFormValues;
  existingBatches?: Batch[];
}

/**
 * Shared create/edit product form. The edit page passes `product` (pre-fill)
 * and `existingBatches` (read-only — batches are never edited or deleted
 * here); both modes can append batch rows, serialized as indexed
 * `batches[i][field]` FormData fields. Fully blank rows are ignored by the
 * server action, so an untouched placeholder row never fails validation.
 */
export function ProductForm({
  categories,
  action,
  cancelHref,
  product,
  existingBatches = [],
}: ProductFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {
    success: false,
    errors: {},
  });

  // The action returns the saved product instead of redirecting — navigate
  // client-side so the success data is available here.
  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/products/${state.data.id}`);
    }
  }, [state.success, state.data, router]);

  /** First message for a field, or undefined so the input renders clean. */
  const fieldError = (key: string) => state.errors[key]?.[0];
  const formError = state.errors["form"]?.[0];

  // Edit starts with zero new rows (existing stock shows as cards); create
  // starts with one empty placeholder row.
  const [rowKeys, setRowKeys] = useState<number[]>(() => (product ? [] : [0]));
  const nextRowKey = useRef(product ? 0 : 1);

  const addRow = () => {
    const key = nextRowKey.current++;
    setRowKeys((keys) => [...keys, key]);
  };
  const removeRow = (key: number) => {
    setRowKeys((keys) => keys.filter((k) => k !== key));
  };
  // Create keeps at least one row on screen; edit rows are purely additive.
  const canRemove = product ? true : rowKeys.length > 1;

  return (
    <form action={formAction} className="space-y-6">
      {product && <input type="hidden" name="id" value={product.id} />}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Product details</CardTitle>
            <CardDescription>
              Stock is tracked per batch — there is no manual stock field.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name" required>
              Product Name
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Paracetamol 500mg"
              defaultValue={product?.name}
              error={fieldError("name")}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="sku" required>
              SKU
            </Label>
            <Input
              id="sku"
              name="sku"
              required
              placeholder="MED-001"
              defaultValue={product?.sku}
              error={fieldError("sku")}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              name="manufacturer"
              placeholder="Cipla"
              defaultValue={product?.manufacturer ?? ""}
              error={fieldError("manufacturer")}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              disabled={isPending}
              aria-invalid={fieldError("categoryId") ? true : undefined}
              className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 ${
                fieldError("categoryId")
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-300"
              }`}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldError("categoryId") && (
              <p className="mt-1.5 text-xs text-red-600">
                {fieldError("categoryId")}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="sellingPrice" required>
              Selling Price (₹)
            </Label>
            <Input
              id="sellingPrice"
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              defaultValue={product ? Number(product.sellingPrice) : undefined}
              error={fieldError("sellingPrice")}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="reorderLevel" required>
              Reorder Level
            </Label>
            <Input
              id="reorderLevel"
              name="reorderLevel"
              type="number"
              min="0"
              required
              defaultValue={product?.reorderLevel ?? 20}
              error={fieldError("reorderLevel")}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="safetyStock" required>
              Safety Stock
            </Label>
            <Input
              id="safetyStock"
              name="safetyStock"
              type="number"
              min="0"
              required
              defaultValue={product?.safetyStock ?? 0}
              error={fieldError("safetyStock")}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {product ? "Batches" : "Opening batches"}
            </h2>
            <p className="text-sm text-slate-500">
              {product
                ? "Existing stock is read-only here — add rows to record new batches."
                : "Record the stock you have on hand. Leave the row blank to skip."}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addRow}
            disabled={isPending}
          >
            <Plus className="size-4" aria-hidden />
            Add Batch
          </Button>
        </div>

        {existingBatches.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {batch.batchNumber}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Expires {formatDateUTC(batch.expiryDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums text-slate-900">
                  {formatNumber(batch.quantity)} units
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatCurrency(batch.purchasePrice)} / unit
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {rowKeys.map((key, index) => (
          <Card key={key}>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_130px_150px_minmax(0,1fr)_auto] lg:items-end">
              <div>
                <Label htmlFor={`batches-${index}-batchNumber`}>
                  Batch Number
                </Label>
                <Input
                  id={`batches-${index}-batchNumber`}
                  name={`batches[${index}][batchNumber]`}
                  placeholder="BN-2026-011"
                  error={fieldError(`batch-${index}-batchNumber`)}
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor={`batches-${index}-quantity`}>Quantity</Label>
                <Input
                  id={`batches-${index}-quantity`}
                  name={`batches[${index}][quantity]`}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="0"
                  error={fieldError(`batch-${index}-quantity`)}
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor={`batches-${index}-purchasePrice`}>
                  Purchase Price (₹)
                </Label>
                <Input
                  id={`batches-${index}-purchasePrice`}
                  name={`batches[${index}][purchasePrice]`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  error={fieldError(`batch-${index}-purchasePrice`)}
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor={`batches-${index}-expiryDate`}>
                  Expiry Date
                </Label>
                <Input
                  id={`batches-${index}-expiryDate`}
                  name={`batches[${index}][expiryDate]`}
                  type="date"
                  error={fieldError(`batch-${index}-expiryDate`)}
                  disabled={isPending}
                />
              </div>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(key)}
                  disabled={isPending}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {product && rowKeys.length === 0 && (
          <p className="text-sm text-slate-500">
            No new batches — only the product details will be updated.
          </p>
        )}
      </section>

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
        <ButtonLink variant="secondary" href={cancelHref}>
          Cancel
        </ButtonLink>
        <Button type="submit" isLoading={isPending} disabled={isPending}>
          {isPending
            ? product
              ? "Saving..."
              : "Creating..."
            : product
              ? "Update Product"
              : "Save Product"}
        </Button>
      </div>
    </form>
  );
}
