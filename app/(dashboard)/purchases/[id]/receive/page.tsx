import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ReceiveOrderForm } from "@/features/purchases/components/receive-order-form";
import { getPurchaseOrderById } from "@/features/purchases/queries";
import { PENDING_PURCHASE_STATUSES } from "@/features/purchases/types";

interface ReceivePurchaseOrderPageProps {
  params: Promise<{ id: string }>;
}

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReceivePurchaseOrderPage({
  params,
}: ReceivePurchaseOrderPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const order = await getPurchaseOrderById(id);

  // Only orders still in flight can be received against.
  if (
    !order ||
    !(PENDING_PURCHASE_STATUSES as readonly string[]).includes(order.status)
  ) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive Stock"
        description={`Purchase Order #${order.id.slice(0, 8)} · ${order.supplierName ?? "No supplier"}`}
      >
        <ButtonLink variant="secondary" href={`/purchases/${order.id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to Order
        </ButtonLink>
      </PageHeader>

      <ReceiveOrderForm order={order} />
    </div>
  );
}
