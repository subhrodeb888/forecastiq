import Link from "next/link";

import { TablePagination } from "@/components/ui/pagination";
import { getProducts } from "@/features/products/queries";
import {
  PAGE_SIZE,
  getTotalPages,
  parsePageParam,
} from "@/lib/pagination";

interface ProductsPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { page } = await searchParams;
  const requestedPage = parsePageParam(page);

  const { items: allProducts, totalCount } = await getProducts(
    requestedPage,
    PAGE_SIZE,
  );
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const currentPage = Math.min(requestedPage, totalPages);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>

          <p className="text-slate-500">Manage your inventory</p>
        </div>

        <Link
          href="/products/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add Product
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Price</th>
            </tr>
          </thead>

          <tbody>
            {allProducts.map((product) => (
              <tr
                key={product.id}
                className="border-t transition-colors hover:bg-slate-50"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {product.name}
                  </Link>
                </td>

                <td className="px-4 py-4">{product.sku}</td>

                <td className="px-4 py-4">{product.category ?? "-"}</td>

                <td className="px-4 py-4">{product.currentStock}</td>

                <td className="px-4 py-4">₹{product.sellingPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {allProducts.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No products found.
          </div>
        )}
      </div>

      <div className="mt-4">
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          basePath="/products"
        />
      </div>
    </div>
  );
}
