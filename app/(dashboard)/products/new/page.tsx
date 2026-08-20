import { asc } from "drizzle-orm";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { createProduct } from "@/app/(dashboard)/products/actions";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/features/products/components/product-form";

export default async function NewProductPage() {
  const categoryOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Product"
        description="Create a catalog item, with its opening stock batches."
      />
      <ProductForm
        categories={categoryOptions}
        action={createProduct}
        cancelHref="/products"
      />
    </div>
  );
}
