import Link from "next/link";

import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRecentSales } from "@/features/sales/queries";
import { formatDateUTC, formatNumber } from "@/lib/format";

const RECENT_SALES_LIMIT = 50;

export default async function SalesPage() {
  const recentSales = await getRecentSales(RECENT_SALES_LIMIT);

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" description="Record transactions">
        <ButtonLink href="/sales/new">New Sale</ButtonLink>
      </PageHeader>

      {recentSales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales yet"
          description="Record your first sale to start tracking revenue and batch-level stock movement."
        />
      ) : (
        <TableContainer>
          <DataTable>
            <TableHead>
              <tr>
                <TableHeader>Sale ID</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader align="right">Items</TableHeader>
                <TableHeader align="right">Total Amount</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/sales/${sale.id}`}
                      title={sale.id}
                      className="text-blue-600 hover:underline"
                    >
                      #{sale.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateUTC(sale.saleDate)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatNumber(sale.itemCount)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {sale.totalAmountLabel}
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      href={`/sales/${sale.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableContainer>
      )}
    </div>
  );
}
