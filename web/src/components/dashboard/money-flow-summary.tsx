"use client";

import { useState, useEffect } from "react";
import { ArrowUpDown, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
import { useSyncStore } from "@/lib/stores/sync-store";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface MoneyFlowData {
  totalBorrowed: number;
  totalAllocated: number;
  totalUnallocated: number;
  totalRepayments: number;
  expensesOwnFunded: number;
  expensesDebtFunded: number;
  expensesTotal: number;
}

export function MoneyFlowSummary() {
  const [data, setData] = useState<MoneyFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      // Fetch debts created this month (borrowed this month)
      const { data: debts } = await supabase
        .from("debts")
        .select("original_amount, allocated_amount")
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd);

      // Fetch BNPL purchases made this month
      const { data: bnplPurchases } = await supabase
        .from("bnpl_purchases")
        .select("total_amount")
        .gte("purchase_date", monthStart)
        .lte("purchase_date", monthEnd);

      // Fetch expenses this month with funding source breakdown
      const { data: expenses } = await supabase
        .from("expense_entries")
        .select("amount, funding_source")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const debtBorrowed = debts?.reduce((s, d) => s + (d.original_amount ?? 0), 0) ?? 0;
      const bnplBorrowed = bnplPurchases?.reduce((s, p) => s + (p.total_amount ?? 0), 0) ?? 0;
      const totalBorrowed = debtBorrowed + bnplBorrowed;
      const totalAllocated = debts?.reduce((s, d) => s + (d.allocated_amount ?? 0), 0) ?? 0;

      let expensesOwnFunded = 0;
      let expensesDebtFunded = 0;
      let totalRepayments = 0;
      let expensesTotal = 0;

      for (const exp of expenses ?? []) {
        expensesTotal += exp.amount;
        if (exp.funding_source === "debt_funded") {
          expensesDebtFunded += exp.amount;
        } else if (exp.funding_source === "debt_repayment") {
          totalRepayments += exp.amount;
        } else {
          expensesOwnFunded += exp.amount;
        }
      }

      setData({
        totalBorrowed,
        totalAllocated,
        totalUnallocated: totalBorrowed - totalAllocated,
        totalRepayments,
        expensesOwnFunded,
        expensesDebtFunded,
        expensesTotal,
      });
      setLoading(false);
    }

    fetchData();
  }, [syncVersion]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.totalBorrowed === 0 && data.totalRepayments === 0 && data.expensesDebtFunded === 0)) {
    return null; // Don't render if no debt-related activity this month
  }

  const netDebtChange = data.totalBorrowed - data.totalRepayments;
  const allocPercent =
    data.totalBorrowed > 0
      ? Math.round((data.totalAllocated / data.totalBorrowed) * 100)
      : 0;

  const monthName = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Money Flow — {monthName}
          </CardTitle>
          <ArrowUpDown className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Borrowed this month */}
        {data.totalBorrowed > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Borrowed this month</span>
              <span className="font-medium">{formatCurrency(data.totalBorrowed)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Allocated: {formatCurrency(data.totalAllocated)} ({allocPercent}%)</span>
              {data.totalUnallocated > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {formatCurrency(data.totalUnallocated)} untracked
                </span>
              )}
            </div>
            <Progress value={allocPercent} className="h-1.5" />
          </div>
        )}

        {/* Repayments */}
        {data.totalRepayments > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Debt repayments</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(data.totalRepayments)}
            </span>
          </div>
        )}

        {/* Net debt change */}
        {(data.totalBorrowed > 0 || data.totalRepayments > 0) && (
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-muted-foreground">Net debt change</span>
            <span className={`font-semibold ${netDebtChange > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {netDebtChange > 0 ? "+" : ""}{formatCurrency(netDebtChange)}
            </span>
          </div>
        )}

        {/* Expenses by source */}
        {data.expensesTotal > 0 && (data.expensesDebtFunded > 0 || data.totalRepayments > 0) && (
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">Expenses by source</p>
            <div className="flex justify-between text-xs">
              <span>Own funds</span>
              <span>{formatCurrency(data.expensesOwnFunded)}</span>
            </div>
            {data.expensesDebtFunded > 0 && (
              <div className="flex justify-between text-xs">
                <span>Debt-funded</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {formatCurrency(data.expensesDebtFunded)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs font-medium border-t pt-1">
              <span>Total</span>
              <span>{formatCurrency(data.expensesTotal)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
