import { createCategory } from "@/app/(dashboard)/categories/actions";

export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-bold">Add Category</h1>

      <form
        action={createCategory}
        className="space-y-6 rounded-xl border bg-white p-8"
      >
        <div>
          <label htmlFor="name" className="mb-2 block font-medium">
            Category Name
          </label>

          <input
            id="name"
            name="name"
            required
            className="w-full rounded-lg border px-4 py-2"
            placeholder="Pain Relief"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block font-medium">
            Description
          </label>

          <textarea
            id="description"
            name="description"
            rows={4}
            className="w-full rounded-lg border px-4 py-2"
            placeholder="Optional description..."
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Save Category
        </button>
      </form>
    </div>
  );
}
