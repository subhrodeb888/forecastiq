"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { batches, products, stockMovements } from "@/db/schema";
import { paiseToMoney, toPaise } from "@/features/inventory/money";
import type {
  ProductActionResult,
  ProductFormState,
} from "@/features/products/types";
import { parseIndexedItems } from "@/lib/form-data";
import { deleteBatchSchema } from "@/lib/validations/batch";
import { createProductSchema } from "@/lib/validations/product";

import { eq } from "drizzle-orm";

/**
 * Batch rows the user never touched arrive as all-empty strings — they are
 * placeholders, not data. Dropping them here means an untouched row never
 * reaches validation, while a half-filled row fails loudly.
 */
function meaningfulBatchRows(
  formData: FormData,
): Record<string, FormDataEntryValue>[] {
  return parseIndexedItems(formData, "batches").filter((row) =>
    Object.values(row).some((value) => String(value).trim() !== ""),
  );
}

/**
 * Map Zod issues to field-keyed messages: root fields keyed by name, batch
 * rows keyed "batch-{index}-{field}", and anything else under "form".
 */
function zodToFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const [head, second, field] = issue.path;
    const key =
      head === "batches" && typeof second === "number"
        ? `batch-${second}-${String(field ?? "form")}`
        : String(head ?? "form");
    (errors[key] ??= []).push(issue.message);
  }

  return errors;
}

/** Map the Postgres unique violation on sku to something human. */
function productSaveError(error: unknown, fallback: string): string {
  if (
    error instanceof Error &&
    error.message.includes("products_sku_unique")
  ) {
    return "That SKU is already in use by another product.";
  }
  return fallback;
}

/**
 * Create a product and its opening batches in one transaction — either the
 * catalog entry and all of its stock exist, or nothing does. Each batch also
 * writes a "purchase" stock movement, matching standalone batch creation.
 *
 * Shaped for `useActionState`: returns field-keyed validation errors for
 * inline display, and the saved product on success (which the form turns
 * into a client-side redirect). Never throws or calls redirect() itself.
 */
export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      errors: { form: ["You must be signed in to create products."] },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    manufacturer: formData.get("manufacturer") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    sellingPrice: formData.get("sellingPrice"),
    reorderLevel: formData.get("reorderLevel"),
    safetyStock: formData.get("safetyStock"),
    batches: meaningfulBatchRows(formData),
  });
  if (!parsed.success) {
    return { success: false, errors: zodToFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  let productId: string;

  try {
    productId = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: data.name,
          sku: data.sku,
          manufacturer: data.manufacturer || null,
          categoryId: data.categoryId || null,
          sellingPrice: paiseToMoney(toPaise(data.sellingPrice)),
          reorderLevel: data.reorderLevel,
          safetyStock: data.safetyStock,
          // currentStock stays at its default — stock is derived from batches.
        })
        .returning({ id: products.id });

      for (const batch of data.batches) {
        const [created] = await tx
          .insert(batches)
          .values({
            productId: product.id,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            purchasePrice: paiseToMoney(toPaise(batch.purchasePrice)),
            expiryDate: batch.expiryDate,
          })
          .returning({ id: batches.id });

        await tx.insert(stockMovements).values({
          productId: product.id,
          batchId: created.id,
          type: "purchase",
          quantity: batch.quantity,
          notes: `Batch ${batch.batchNumber} created`,
          userId,
        });
      }

      return product.id;
    });
  } catch (error) {
    console.error("create product failed", error);
    return {
      success: false,
      errors: {
        form: [
          productSaveError(
            error,
            "Could not create the product. Please try again.",
          ),
        ],
      },
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return {
    success: true,
    errors: {},
    data: { id: productId, name: data.name, sku: data.sku },
  };
}

/**
 * Update a product's details and append any new batches in one transaction.
 * Existing batches are deliberately never modified or deleted from the edit
 * form — their quantities move only through sales, receipts and adjustments.
 *
 * Shaped for `useActionState`: returns field-keyed validation errors for
 * inline display, and the saved product on success (which the form turns
 * into a client-side redirect). Never throws or calls redirect() itself.
 */
export async function updateProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      errors: { form: ["You must be signed in to update products."] },
    };
  }
  // Extract once — property narrowing does not survive into tx closures.
  const userId = session.user.id ?? null;

  const parsedId = z.string().uuid().safeParse(formData.get("id"));
  if (!parsedId.success) {
    return { success: false, errors: { form: ["Invalid product."] } };
  }
  const productId = parsedId.data;

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    manufacturer: formData.get("manufacturer") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    sellingPrice: formData.get("sellingPrice"),
    reorderLevel: formData.get("reorderLevel"),
    safetyStock: formData.get("safetyStock"),
    batches: meaningfulBatchRows(formData),
  });
  if (!parsed.success) {
    return { success: false, errors: zodToFieldErrors(parsed.error) };
  }

  const data = parsed.data;

  try {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!existing[0]) {
      return { success: false, errors: { form: ["Product not found."] } };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: data.name,
          sku: data.sku,
          manufacturer: data.manufacturer || null,
          categoryId: data.categoryId || null,
          sellingPrice: paiseToMoney(toPaise(data.sellingPrice)),
          reorderLevel: data.reorderLevel,
          safetyStock: data.safetyStock,
        })
        .where(eq(products.id, productId));

      for (const batch of data.batches) {
        const [created] = await tx
          .insert(batches)
          .values({
            productId,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            purchasePrice: paiseToMoney(toPaise(batch.purchasePrice)),
            expiryDate: batch.expiryDate,
          })
          .returning({ id: batches.id });

        await tx.insert(stockMovements).values({
          productId,
          batchId: created.id,
          type: "purchase",
          quantity: batch.quantity,
          notes: `Batch ${batch.batchNumber} created`,
          userId,
        });
      }
    });
  } catch (error) {
    console.error("update product failed", error);
    return {
      success: false,
      errors: {
        form: [
          productSaveError(
            error,
            "Could not update the product. Please try again.",
          ),
        ],
      },
    };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return {
    success: true,
    errors: {},
    data: { id: productId, name: data.name, sku: data.sku },
  };
}

/**
 * Delete a product. Its batches cascade away; sale and purchase ledger rows
 * keep their own records, so transaction history survives the deletion.
 *
 * Redirects to the product list on success; failures resolve as a structured
 * ProductActionResult for useActionState, never a throw.
 */
export async function deleteProduct(
  formData: FormData,
): Promise<ProductActionResult> {
  // Server actions are publicly reachable POST endpoints — always authorize.
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to delete products." },
    };
  }

  const parsedId = z.string().uuid().safeParse(formData.get("id"));
  if (!parsedId.success) {
    return { ok: false, error: { message: "Invalid product." } };
  }
  const productId = parsedId.data;

  try {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!existing[0]) {
      return { ok: false, error: { message: "Product not found." } };
    }

    // Single statement — no transaction needed.
    await db.delete(products).where(eq(products.id, productId));
  } catch (error) {
    console.error("delete product failed", error);
    return {
      ok: false,
      error: { message: "Could not delete the product. Please try again." },
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect("/products");
}

/**
 * Delete a single batch. References from sale items and stock movements are
 * set null by the database, so sales and audit history survive the deletion.
 *
 * Shaped for `useActionState` — always resolves with a ProductActionResult,
 * never throws.
 */
export async function deleteBatch(
  formData: FormData,
): Promise<ProductActionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      error: { message: "You must be signed in to delete batches." },
    };
  }

  const parsed = deleteBatchSchema.safeParse({
    batchId: formData.get("batchId"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return { ok: false, error: { message: "Invalid batch." } };
  }

  try {
    const existing = await db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, parsed.data.batchId))
      .limit(1);
    if (!existing[0]) {
      return { ok: false, error: { message: "Batch not found." } };
    }

    // Single statement — no transaction needed.
    await db.delete(batches).where(eq(batches.id, parsed.data.batchId));
  } catch (error) {
    console.error("delete batch failed", error);
    return {
      ok: false,
      error: { message: "Could not delete the batch. Please try again." },
    };
  }

  revalidatePath(`/products/${parsed.data.productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
