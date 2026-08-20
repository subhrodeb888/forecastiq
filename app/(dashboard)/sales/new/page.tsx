import { PageHeader } from "@/components/ui/page-header";
import { SaleForm } from "@/features/sales/components/sale-form";
import { listSaleProducts } from "@/features/sales/queries";

interface NewSalePageProps {
  searchParams: Promise<{ product?: string | string[] }>;
}

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const [{ product }, productOptions] = await Promise.all([
    searchParams,
    listSaleProducts(),
  ]);

  // ?product=<id> preselects a product (e.g. from the product detail page) —
  // but only if it actually exists in the catalog.
  const candidate = Array.isArray(product) ? product[0] : product;
  const preselectedProductId = productOptions.some((p) => p.id === candidate)
    ? candidate
    : undefined;

  // Computed once on the server so the client never re-derives it.
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New Sale"
        description="Record a sale — stock is deducted FEFO, oldest expiry first."
      />
      <SaleForm
        products={productOptions}
        preselectedProductId={preselectedProductId}
        todayIso={todayIso}
      />
    </div>
  );
}
