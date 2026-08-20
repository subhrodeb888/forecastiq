"use client";

import { useActionState } from "react";

import { AlertCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { deleteBatch } from "@/app/(dashboard)/products/actions";
import type { ProductActionResult } from "@/features/products/types";

interface DeleteBatchButtonProps {
  batchId: string;
  productId: string;
}

/**
 * Per-row batch delete on the product detail page. Deleting a batch silently
 * removes its remaining stock from inventory, so the browser confirms first;
 * failures surface inline beside the button.
 */
export function DeleteBatchButton({ batchId, productId }: DeleteBatchButtonProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ProductActionResult | null, formData: FormData) =>
      deleteBatch(formData),
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this batch? Its remaining stock will be removed from inventory.",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex items-center justify-end gap-2"
    >
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="productId" value={productId} />
      {state && !state.ok && (
        <span
          role="alert"
          className="flex items-center gap-1 text-xs text-red-600"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {state.error.message}
        </span>
      )}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        isLoading={isPending}
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    </form>
  );
}
