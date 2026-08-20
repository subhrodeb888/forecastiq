"use client";

import { useState } from "react";

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";

/** Minimal product shape the combobox needs — richer option types work too. */
export interface ProductComboboxOption {
  id: string;
  name: string;
  sku: string;
}

interface ProductComboboxProps {
  products: ProductComboboxOption[];
  value: ProductComboboxOption | null;
  onChange: (product: ProductComboboxOption) => void;
  disabled?: boolean;
  /** Shows a spinner while the selection is being applied (navigation). */
  loading?: boolean;
}

/**
 * Accessible, searchable product select. Selection is communicated via
 * `onChange`; the parent owns the value.
 */
export function ProductCombobox({
  products,
  value,
  onChange,
  disabled = false,
  loading = false,
}: ProductComboboxProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered =
    normalizedQuery === ""
      ? products
      : products.filter(
          (product) =>
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.sku.toLowerCase().includes(normalizedQuery),
        );

  return (
    <Combobox
      value={value}
      by="id"
      immediate
      disabled={disabled}
      onChange={(product: ProductComboboxOption | null) => {
        if (product) onChange(product);
      }}
      onClose={() => setQuery("")}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />

        <ComboboxInput
          autoComplete="off"
          placeholder="Search products by name or SKU…"
          displayValue={(product: ProductComboboxOption | null) => product?.name ?? ""}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-9 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
        />

        <ComboboxButton className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-4" />
          )}
        </ComboboxButton>
      </div>

      <ComboboxOptions
        anchor="bottom start"
        className="z-50 mt-1 max-h-72 w-[var(--input-width)] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg focus:outline-none"
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-sm text-slate-500">
            No products match &ldquo;{query}&rdquo;.
          </li>
        ) : (
          filtered.map((product) => (
            <ComboboxOption
              key={product.id}
              value={product}
              className="group flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 data-[focus]:bg-blue-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {product.name}
                </span>
                <span className="block text-xs text-slate-500">{product.sku}</span>
              </span>
              <Check className="invisible size-4 shrink-0 text-blue-600 group-data-[selected]:visible" />
            </ComboboxOption>
          ))
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
