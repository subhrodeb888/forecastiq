"use client";

import { useActionState } from "react";

import { AlertCircle } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";

import { cancelPurchaseOrder, placePurchaseOrder } from "../actions";
import type { PurchaseActionResult, PurchaseStatus } from "../types";

interface PurchaseOrderActionsProps {
  orderId: string;
  status: PurchaseStatus;
}

/**
 * Header actions for the purchase order detail page, driven by status:
 * draft → Place Order; ordered/partially received → Receive Stock; anything
 * still in flight → Cancel Order. Terminal statuses render nothing.
 */
export function PurchaseOrderActions({
  orderId,
  status,
}: PurchaseOrderActionsProps) {
  const [placeState, placeAction, placePending] = useActionState(
    async (_prev: PurchaseActionResult | null, formData: FormData) =>
      placePurchaseOrder(formData),
    null,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    async (_prev: PurchaseActionResult | null, formData: FormData) =>
      cancelPurchaseOrder(formData),
    null,
  );

  // Received and cancelled orders have no further actions.
  if (status === "received" || status === "cancelled") return null;

  const errorMessage =
    (placeState && !placeState.ok && placeState.error.message) ||
    (cancelState && !cancelState.ok && cancelState.error.message) ||
    null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {status === "draft" && (
          <form action={placeAction}>
            <input type="hidden" name="purchaseId" value={orderId} />
            <Button type="submit" isLoading={placePending}>
              Place Order
            </Button>
          </form>
        )}

        {(status === "ordered" || status === "partially_received") && (
          <ButtonLink href={`/purchases/${orderId}/receive`}>
            Receive Stock
          </ButtonLink>
        )}

        <form action={cancelAction}>
          <input type="hidden" name="purchaseId" value={orderId} />
          <Button type="submit" variant="danger" isLoading={cancelPending}>
            Cancel Order
          </Button>
        </form>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-red-600"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {errorMessage}
        </p>
      )}
    </div>
  );
}
