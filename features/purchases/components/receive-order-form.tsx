"use client";

import { useActionState, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertCircle } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { receivePurchaseOrder } from "../actions";
import type { PurchaseOrderWithItems } from "../types";

interface ReceiveOrderFormProps {
  order: PurchaseOrderWithItems;
}

/**
 * Goods-receipt form: one row per order line. A line is only serialized into
 * FormData — as indexed `receivedItems[i][field]` inputs — once its quantity
 * received rises above zero, so lines left at zero are skipped entirely.
 * That is how partial receipts work; the server still validates totals
 * against what remains outstanding on the order.
 */
export function ReceiveOrderForm({ order }: ReceiveOrderFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    receivePurchaseOrder,
    { success: false, errors: {} },
  );
  const [quantities, setQuantities] = useState<number[]>(() =>
    order.items.map(() => 0),
  );

  // A successful receipt revalidates the order — send the user back to it.
  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/purchases/${order.id}`);
    }
  }, [state.success, state.data, order.id, router]);

  /** First message for a field, or undefined so the input renders clean. */
  const fieldError = (key: string) => state.errors[key]?.[0];
  const formError = state.errors["form"]?.[0];

  const setQuantity = (index: number, value: number) => {
    setQuantities((current) =>
      current.map((qty, i) => (i === index ? value : qty)),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="purchaseId" value={order.id} />

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Items to receive</CardTitle>
            <CardDescription>
              Enter the quantity that arrived, with the batch number and expiry
              date for each. Lines left at zero are not received.
            </CardDescription>
          </div>
        </CardHeader>

        <DataTable>
          <TableHead>
            <tr>
              <TableHeader>Product</TableHeader>
              <TableHeader align="right">Qty Ordered</TableHeader>
              <TableHeader>Qty Received</TableHeader>
              <TableHeader>Batch Number</TableHeader>
              <TableHeader>Expiry Date</TableHeader>
            </tr>
          </TableHead>
          <TableBody>
            {order.items.map((item, index) => {
              const included = quantities[index] > 0;
              const fieldPrefix = `receivedItems[${index}]`;

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <input
                      type="hidden"
                      name={included ? `${fieldPrefix}[productId]` : undefined}
                      value={item.productId}
                      disabled={!included}
                    />
                    <p className="font-medium text-slate-900">
                      {item.productName}
                    </p>
                    <p className="text-xs text-slate-500">{item.productSku}</p>
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="w-28">
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      step={1}
                      name={included ? `${fieldPrefix}[quantity]` : undefined}
                      value={quantities[index]}
                      onChange={(event) =>
                        setQuantity(
                          index,
                          Math.max(0, Number(event.target.value) || 0),
                        )
                      }
                      error={fieldError(`receivedItems-${index}-quantity`)}
                      disabled={isPending}
                      aria-label={`Quantity received for ${item.productName}`}
                    />
                  </TableCell>
                  <TableCell className="w-44">
                    <Input
                      type="text"
                      name={
                        included ? `${fieldPrefix}[batchNumber]` : undefined
                      }
                      placeholder="e.g. BN-2026-011"
                      required={included}
                      error={fieldError(`receivedItems-${index}-batchNumber`)}
                      disabled={!included || isPending}
                      aria-label={`Batch number for ${item.productName}`}
                    />
                  </TableCell>
                  <TableCell className="w-44">
                    <Input
                      type="date"
                      name={
                        included ? `${fieldPrefix}[expiryDate]` : undefined
                      }
                      required={included}
                      error={fieldError(`receivedItems-${index}-expiryDate`)}
                      disabled={!included || isPending}
                      aria-label={`Expiry date for ${item.productName}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
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
        <ButtonLink variant="secondary" href={`/purchases/${order.id}`}>
          Cancel
        </ButtonLink>
        <Button type="submit" isLoading={isPending} disabled={isPending}>
          {isPending ? "Receiving..." : "Confirm Receipt"}
        </Button>
      </div>
    </form>
  );
}
