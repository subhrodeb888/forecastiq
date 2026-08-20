import { notFound } from "next/navigation";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { updateProduct } from "@/app/(dashboard)/products/actions";
import { PageHeader } from "@/components/ui/page-header";
import { getProductBatches } from "@/features/inventory/queries";
import { ProductForm } from "@/features/products/components/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

/** Junk ids 404 here instead of blowing up on Postgres's uuid type. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  // Independent reads — fetched in parallel over the pooled connection.
  const [result, categoryOptions, existingBatches] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
    getProductBatches(id),
  ]);

  const product = result[0];
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Edit Product" description={product.name} />
      <ProductForm
        categories={categoryOptions}
        action={updateProduct}
        cancelHref={`/products/${product.id}`}
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          manufacturer: product.manufacturer,
          categoryId: product.categoryId,
          sellingPrice: product.sellingPrice,
          reorderLevel: product.reorderLevel,
          safetyStock: product.safetyStock,
        }}
        existingBatches={existingBatches}
      />
    </div>
  );
}
