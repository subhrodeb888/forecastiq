/** Discriminated result returned by the product server actions. */
export type ProductActionResult =
  | { ok: true }
  | { ok: false; error: { message: string } };

/** Category option for the product form's category select. */
export interface CategoryOption {
  id: string;
  name: string;
}

/** Product values the shared form is pre-filled with on the edit page. */
export interface ProductFormValues {
  id: string;
  name: string;
  sku: string;
  manufacturer: string | null;
  categoryId: string | null;
  /** Decimal string straight from the driver, e.g. "12.50". */
  sellingPrice: string;
  reorderLevel: number;
  safetyStock: number;
}

/** One row of the paginated product list. */
export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  manufacturer: string | null;
  /** Decimal string straight from the driver, e.g. "12.50". */
  sellingPrice: string;
  currentStock: number;
  reorderLevel: number;
  /** Category name; null when uncategorized. */
  category: string | null;
}

/** The saved product, returned by create/update on success. */
export interface SavedProduct {
  id: string;
  name: string;
  sku: string;
}

/**
 * State shape for the shared create/edit form. `errors` is keyed by field
 * name so the form can render each message inline; batch field errors are
 * keyed "batch-{index}-{field}", and non-field failures use "form".
 */
export interface ProductFormState {
  success: boolean;
  errors: Record<string, string[]>;
  /** Present on success — the form navigates to this product. */
  data?: SavedProduct;
}
