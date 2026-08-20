import Link from "next/link";

import { Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TablePagination } from "@/components/ui/pagination";
import {
  DataTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSuppliers } from "@/features/suppliers/queries";
import { formatNumber } from "@/lib/format";
import {
  PAGE_SIZE,
  getTotalPages,
  parsePageParam,
} from "@/lib/pagination";

interface SuppliersPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const { page } = await searchParams;
  const requestedPage = parsePageParam(page);

  const { items: supplierList, totalCount } = await getSuppliers(
    requestedPage,
    PAGE_SIZE,
  );
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);
  const currentPage = Math.min(requestedPage, totalPages);

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage vendors">
        <ButtonLink href="/suppliers/new">Add Supplier</ButtonLink>
      </PageHeader>

      {supplierList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No suppliers yet"
          description="Add your first supplier to start raising purchase orders and tracking procurement."
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Name</TableHeader>
                <TableHeader>Contact Person</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Phone</TableHeader>
                <TableHeader align="right">Total Orders</TableHeader>
                <TableHeader align="right">Total Spend</TableHeader>
                <TableHeader align="right">Avg Delivery (days)</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {supplierList.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.name}
                    </Link>
                  </TableCell>
                  <TableCell>{supplier.contactPerson ?? "—"}</TableCell>
                  <TableCell>
                    {supplier.email ? (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="text-slate-600 hover:text-blue-600 hover:underline"
                      >
                        {supplier.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.phone ? (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="text-slate-600 hover:text-blue-600 hover:underline"
                      >
                        {supplier.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatNumber(supplier.totalOrders)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {supplier.totalSpendLabel}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {supplier.averageDeliveryDays === null
                      ? "—"
                      : supplier.averageDeliveryDays.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableContainer>
      )}

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/suppliers"
      />
    </div>
  );
}
