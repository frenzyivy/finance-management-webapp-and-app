"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { ClientRevenue } from "@/hooks/use-business-analytics";

interface ClientProfitabilityTableProps {
  rows: ClientRevenue[];
}

export function ClientProfitabilityTable({ rows }: ClientProfitabilityTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No client profitability data yet. Link income and expenses to clients to see this table.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Expenses</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const positive = r.profit >= 0;
            return (
              <TableRow key={r.clientId}>
                <TableCell className="font-medium">{r.clientName}</TableCell>
                <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(r.revenue)}
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                  {r.attributedExpenses > 0 ? formatCurrency(r.attributedExpenses) : "—"}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    positive ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {formatCurrency(r.profit)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="secondary"
                    className={`gap-1 ${
                      positive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {r.margin.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}