"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  PieChart as PieIcon,
  Users,
  CalendarClock,
  Sparkles,
  AlertCircle,
  Loader2,
  Filter,
} from "lucide-react";

import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import { formatCurrency } from "@/lib/utils/currency";
import { SUBSCRIPTION_CATEGORIES } from "@/lib/constants/business-categories";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PnLChart } from "@/components/business/charts/pnl-chart";
import { ExpenseBreakdownChart } from "@/components/business/charts/expense-breakdown-chart";
import { RevenueByClientChart } from "@/components/business/charts/revenue-by-client-chart";
import { SubscriptionTrendChart } from "@/components/business/charts/subscription-trend-chart";
import { ClientProfitabilityTable } from "@/components/business/client-profitability-table";

function getSubscriptionCategoryLabel(value: string) {
  return SUBSCRIPTION_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function BusinessAnalyticsPage() {
  const {
    loading,
    pnl,
    expenseBreakdown,
    clientProfitability,
    subscriptionTrend,
    subscriptionSplit,
  } = useBusinessAnalytics();

  // Six-month totals for summary cards
  const totals = useMemo(() => {
    const revenue = pnl.reduce((s, m) => s + m.revenue, 0);
    const expenses = pnl.reduce((s, m) => s + m.expenses, 0);
    return {
      revenue,
      expenses,
      profit: revenue - expenses,
      margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
    };
  }, [pnl]);

  const filteredNiceToHave = subscriptionSplit.niceToHave;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Business Analytics</h2>
            <p className="text-sm text-muted-foreground">
              Profit trends, client profitability, and subscription insights (last 6 months)
            </p>
          </div>
        </div>
      </div>

      {/* 6-month summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (6mo)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses (6mo)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totals.expenses)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit (6mo)</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totals.profit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(totals.profit)}
            </p>
            {totals.revenue > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {totals.margin.toFixed(1)}% margin
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{clientProfitability.length}</p>
            <p className="text-xs text-muted-foreground mt-1">with recorded activity</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pnl" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pnl" className="gap-1.5"><BarChart3 className="size-3.5" /> P&amp;L</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5"><PieIcon className="size-3.5" /> Expenses</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Users className="size-3.5" /> Clients</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5"><CalendarClock className="size-3.5" /> Subscriptions</TabsTrigger>
        </TabsList>

        {/* P&L TAB */}
        <TabsContent value="pnl" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>6-Month Profit &amp; Loss</CardTitle>
              <CardDescription>
                Monthly revenue vs expenses. Blue dots show net profit; red dots mean a loss month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PnLChart data={pnl} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Where business money goes (this month)</CardTitle>
              <CardDescription>
                Expense breakdown by category for the current month.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseBreakdownChart data={expenseBreakdown} />
            </CardContent>
          </Card>
          {expenseBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {expenseBreakdown.map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-sm font-medium truncate">{c.label}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatCurrency(c.amount)}</p>
                        <p className="text-xs text-muted-foreground">{c.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CLIENTS TAB */}
        <TabsContent value="clients" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by client (top 10, last 6 months)</CardTitle>
              <CardDescription>
                Bars are colored by profitability — blue = profitable, red = loss-making.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueByClientChart data={clientProfitability} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client profitability</CardTitle>
              <CardDescription>
                Profit = revenue minus expenses attributed to that client. Margin is profit / revenue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientProfitabilityTable rows={clientProfitability} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUBSCRIPTIONS TAB */}
        <TabsContent value="subscriptions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription spend trend</CardTitle>
              <CardDescription>
                Bars show actual spend linked to subscriptions; the dashed line is current planned burn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionTrendChart data={subscriptionTrend} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" /> Essential
                </CardTitle>
                <CardDescription>
                  {subscriptionSplit.essentialCount} tool
                  {subscriptionSplit.essentialCount === 1 ? "" : "s"} you marked essential
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(subscriptionSplit.essentialBurn)}/mo
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-500" /> Nice-to-have
                </CardTitle>
                <CardDescription>
                  {subscriptionSplit.niceToHaveCount} tool
                  {subscriptionSplit.niceToHaveCount === 1 ? "" : "s"} — potential cost-cutting candidates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(subscriptionSplit.niceToHaveBurn)}/mo
                </p>
              </CardContent>
            </Card>
          </div>

          {subscriptionSplit.niceToHaveCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="size-4" /> Nice-to-have subscriptions
                </CardTitle>
                <CardDescription>
                  Review these to cut monthly costs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredNiceToHave.map((s) => (
                    <Link
                      key={s.id}
                      href={`/business/expenses?subscription_id=${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {getSubscriptionCategoryLabel(s.category)}
                        </Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {formatCurrency(s.monthly_equivalent ?? 0)}/mo
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {s.billing_cycle}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}