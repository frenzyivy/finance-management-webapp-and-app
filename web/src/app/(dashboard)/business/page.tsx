"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  CalendarClock,
  ArrowUp,
  ArrowDown,
  Users,
  Briefcase,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { BUSINESS_INCOME_CATEGORIES, BUSINESS_EXPENSE_CATEGORIES } from "@/lib/constants/business-categories";
import { PersonalBusinessBridge } from "@/components/business/personal-business-bridge";

interface BusinessSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  monthlySubscriptionBurn: number;
  actualSubscriptionSpend: number;
  activeSubscriptions: number;
  activeClients: number;
}

interface BusinessTransaction {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
}

function getCategoryLabel(category: string, type: "income" | "expense"): string {
  const list = type === "income" ? BUSINESS_INCOME_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
  return list.find((c) => c.value === category)?.label || category;
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
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
    key: "totalRevenue" as const,
    title: "Revenue This Month",
    icon: ArrowUpCircle,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    key: "totalExpenses" as const,
    title: "Expenses This Month",
    icon: ArrowDownCircle,
    iconColor: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  {
    key: "netProfit" as const,
    title: "Net Profit",
    icon: TrendingUp,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    key: "monthlySubscriptionBurn" as const,
    title: "Subscription Burn (Planned)",
    icon: CalendarClock,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    subtitle: "activeSubscriptions",
  },
  {
    key: "actualSubscriptionSpend" as const,
    title: "Actual Sub Spend (MTD)",
    icon: CalendarClock,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
];

export default function BusinessDashboardPage() {
  const [summary, setSummary] = useState<BusinessSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    monthlySubscriptionBurn: 0,
    actualSubscriptionSpend: 0,
    activeSubscriptions: 0,
    activeClients: 0,
  });
  const [transactions, setTransactions] = useState<BusinessTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBusinessData() {
      try {
        const supabase = createClient();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        const [
          incomeRes,
          expenseRes,
          subsRes,
          subSpendRes,
          clientsRes,
          recentIncomeRes,
          recentExpenseRes,
        ] = await Promise.all([
          supabase
            .from("business_income")
            .select("amount")
            .gte("date", startOfMonth)
            .lte("date", endOfMonth),
          supabase
            .from("business_expenses")
            .select("amount")
            .gte("date", startOfMonth)
            .lte("date", endOfMonth),
          supabase
            .from("business_subscriptions")
            .select("monthly_equivalent, status")
            .eq("status", "active"),
          supabase
            .from("business_expenses")
            .select("amount")
            .not("subscription_id", "is", null)
            .gte("date", startOfMonth)
            .lte("date", endOfMonth),
          supabase
            .from("business_clients")
            .select("id")
            .eq("status", "active"),
          supabase
            .from("business_income")
            .select("id, source_name, category, date, amount")
            .order("date", { ascending: false })
            .limit(5),
          supabase
            .from("business_expenses")
            .select("id, vendor_name, category, date, amount")
            .order("date", { ascending: false })
            .limit(5),
        ]);

        const queries = { incomeRes, expenseRes, subsRes, subSpendRes, clientsRes, recentIncomeRes, recentExpenseRes };
        for (const [name, res] of Object.entries(queries)) {
          if (res.error) {
            console.error(`Business dashboard query "${name}" failed:`, res.error.message, res.error.code);
            throw new Error(`${name}: ${res.error.message}`);
          }
        }

        const totalRevenue = (incomeRes.data || []).reduce(
          (sum, row) => sum + (Number(row.amount) || 0),
          0
        );
        const totalExpenses = (expenseRes.data || []).reduce(
          (sum, row) => sum + (Number(row.amount) || 0),
          0
        );
        const monthlySubscriptionBurn = (subsRes.data || []).reduce(
          (sum, row) => sum + (Number(row.monthly_equivalent) || 0),
          0
        );
        const actualSubscriptionSpend = (subSpendRes.data || []).reduce(
          (sum, row) => sum + (Number(row.amount) || 0),
          0
        );
        const activeSubscriptions = (subsRes.data || []).length;
        const activeClients = (clientsRes.data || []).length;

        setSummary({
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
          monthlySubscriptionBurn,
          actualSubscriptionSpend,
          activeSubscriptions,
          activeClients,
        });

        const incomeTransactions: BusinessTransaction[] = (recentIncomeRes.data || []).map(
          (row) => ({
            id: row.id,
            type: "income" as const,
            description: row.source_name,
            category: row.category,
            date: row.date,
            amount: Number(row.amount),
          })
        );

        const expenseTransactions: BusinessTransaction[] = (recentExpenseRes.data || []).map(
          (row) => ({
            id: row.id,
            type: "expense" as const,
            description: row.vendor_name,
            category: row.category,
            date: row.date,
            amount: Number(row.amount),
          })
        );

        const merged = [...incomeTransactions, ...expenseTransactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);

        setTransactions(merged);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to fetch business dashboard data:", message);
        toast.error("Failed to load business data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchBusinessData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
              <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Allianza Biz</h2>
              <p className="text-muted-foreground">
                Business finance overview
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/business/income">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Income
          </Button>
        </Link>
        <Link href="/business/expenses">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Expense
          </Button>
        </Link>
        <Link href="/business/subscriptions">
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarClock className="h-4 w-4" /> Subscriptions
          </Button>
        </Link>
        <Link href="/business/clients">
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" /> Clients
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCardConfig.map((card) => {
            const Icon = card.icon;
            const value = summary[card.key];
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
                  <p className="text-2xl font-bold">{formatCurrency(value)}</p>
                  {card.key === "monthlySubscriptionBurn" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.activeSubscriptions} active subscription{summary.activeSubscriptions !== 1 ? "s" : ""}
                    </p>
                  )}
                  {card.key === "actualSubscriptionSpend" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Linked business expenses
                    </p>
                  )}
                  {card.key === "netProfit" && summary.totalRevenue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {((summary.netProfit / summary.totalRevenue) * 100).toFixed(1)}% margin
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Clients Card */}
      {!loading && summary.activeClients > 0 && (
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Active Clients</p>
              <p className="text-2xl font-bold">{summary.activeClients}</p>
            </div>
            <Link href="/business/clients">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Personal ↔ Business Bridge */}
      <PersonalBusinessBridge />

      {/* Recent Business Transactions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold tracking-tight">
          Recent Business Transactions
        </h3>
        {loading ? (
          <TransactionsSkeleton />
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No business transactions yet. Start by adding business income or expenses.
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
                      {getCategoryLabel(tx.category, tx.type)}
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
