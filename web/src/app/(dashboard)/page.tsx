"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  PiggyBank,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsProgress: number;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted-foreground/10" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 animate-pulse rounded bg-muted-foreground/10" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted-foreground/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted-foreground/10" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/10" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}

const summaryCardConfig = [
  {
    key: "totalIncome" as const,
    title: "Total Income This Month",
    icon: ArrowUpCircle,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    key: "totalExpenses" as const,
    title: "Total Expenses This Month",
    icon: ArrowDownCircle,
    iconColor: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  {
    key: "netCashFlow" as const,
    title: "Net Cash Flow",
    icon: TrendingUp,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    key: "savingsProgress" as const,
    title: "Savings Progress",
    icon: PiggyBank,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950",
  },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData>({
    totalIncome: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    savingsProgress: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const supabase = createClient();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const [incomeRes, expenseRes, savingsRes, recentIncomeRes, recentExpenseRes] =
          await Promise.all([
            supabase
              .from("income_entries")
              .select("amount")
              .gte("date", startOfMonth)
              .lte("date", endOfMonth),
            supabase
              .from("expense_entries")
              .select("amount")
              .gte("date", startOfMonth)
              .lte("date", endOfMonth),
            supabase.from("savings_goals").select("current_balance"),
            supabase
              .from("income_entries")
              .select("id, source_name, category, date, amount")
              .order("date", { ascending: false })
              .limit(5),
            supabase
              .from("expense_entries")
              .select("id, payee_name, category, date, amount")
              .order("date", { ascending: false })
              .limit(5),
          ]);

        if (incomeRes.error) throw incomeRes.error;
        if (expenseRes.error) throw expenseRes.error;
        if (savingsRes.error) throw savingsRes.error;
        if (recentIncomeRes.error) throw recentIncomeRes.error;
        if (recentExpenseRes.error) throw recentExpenseRes.error;

        const totalIncome = (incomeRes.data || []).reduce(
          (sum, row) => sum + (Number(row.amount) || 0),
          0
        );
        const totalExpenses = (expenseRes.data || []).reduce(
          (sum, row) => sum + (Number(row.amount) || 0),
          0
        );
        const savingsProgress = (savingsRes.data || []).reduce(
          (sum, row) => sum + (Number(row.current_balance) || 0),
          0
        );

        setSummary({
          totalIncome,
          totalExpenses,
          netCashFlow: totalIncome - totalExpenses,
          savingsProgress,
        });

        const incomeTransactions: Transaction[] = (recentIncomeRes.data || []).map(
          (row) => ({
            id: row.id,
            type: "income" as const,
            description: row.source_name,
            category: row.category || "Income",
            date: row.date,
            amount: Number(row.amount),
          })
        );

        const expenseTransactions: Transaction[] = (recentExpenseRes.data || []).map(
          (row) => ({
            id: row.id,
            type: "expense" as const,
            description: row.payee_name,
            category: row.category || "Expense",
            date: row.date,
            amount: Number(row.amount),
          })
        );

        const merged = [...incomeTransactions, ...expenseTransactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);

        setTransactions(merged);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        toast.error("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Your financial overview at a glance.
        </p>
      </div>

      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCardConfig.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.key}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary[card.key])}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold tracking-tight">
          Recent Transactions
        </h3>
        {loading ? (
          <TransactionsSkeleton />
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No transactions yet. Start by adding income or expenses.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={`${tx.type}-${tx.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    tx.type === "income"
                      ? "bg-emerald-50 dark:bg-emerald-950"
                      : "bg-red-50 dark:bg-red-950"
                  }`}
                >
                  {tx.type === "income" ? (
                    <ArrowUp className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tx.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {tx.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold shrink-0 ${
                    tx.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
