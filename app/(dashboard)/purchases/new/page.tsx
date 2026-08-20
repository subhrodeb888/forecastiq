import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderForm } from "@/features/purchases/components/purchase-order-form";
import { listProductOptions } from "@/features/purchases/queries";
import { listSupplierOptions } from "@/features/suppliers/queries";

interface NewPurchaseOrderPageProps {
  searchParams: Promise<{
    product?: string | string[];
    quantity?: string | string[];
  }>;
}

export default async function NewPurchaseOrderPage({
  searchParams,
}: NewPurchaseOrderPageProps) {
  const [{ product, quantity }, productOptions, supplierOptions] =
    await Promise.all([searchParams, listProductOptions(), listSupplierOptions()]);

  // ?product=<id>&quantity=<n> prefill the first row (reorder engine links
  // here) — but only values that survive validation reach the form.
  const candidate = Array.isArray(product) ? product[0] : product;
  const prefillProductId = productOptions.some((p) => p.id === candidate)
    ? candidate
    : undefined;

  const quantityCandidate = Number(
    Array.isArray(quantity) ? quantity[0] : quantity,
  );
  const prefillQuantity =
    Number.isInteger(quantityCandidate) && quantityCandidate > 0
      ? quantityCandidate
      : undefined;

  const prefill = prefillProductId
    ? { productId: prefillProductId, quantity: prefillQuantity }
    : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="New Purchase Order"
        description="Add items and a supplier — totals are computed when the order is created."
      />
      <PurchaseOrderForm
        products={productOptions}
        suppliers={supplierOptions}
        prefill={prefill}
      />
    </div>
  );
}
