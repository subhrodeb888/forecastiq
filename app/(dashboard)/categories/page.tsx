import Link from "next/link";

import { db } from "@/db";
import { categories } from "@/db/schema";

export default async function CategoriesPage() {
  const allCategories = await db.select().from(categories);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>

          <p className="text-slate-500">Manage product categories</p>
        </div>

        <Link
          href="/categories/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add Category
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>

              <th className="px-4 py-3 text-left">Description</th>
            </tr>
          </thead>

          <tbody>
            {allCategories.map((category) => (
              <tr key={category.id} className="border-t">
                <td className="px-4 py-4">{category.name}</td>

                <td className="px-4 py-4">{category.description ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {allCategories.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No categories found.
          </div>
        )}
      </div>
    </div>
  );
}
