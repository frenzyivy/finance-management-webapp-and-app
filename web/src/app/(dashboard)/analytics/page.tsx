"use client";

import { addMonths, subMonths, format } from "date-fns";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Calendar,
  Target,
  AlertTriangle,
} from "lucide-react";

import { useAnalytics } from "@/hooks/use-analytics";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { ExpensePieChart } from "@/components/charts/expense-pie-chart";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend-chart";
import { DailySpendingChart } from "@/components/charts/daily-spending-chart";

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function SkeletonChart({ height = "h-[300px]" }: { height?: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className={`${height} w-full animate-pulse rounded bg-muted`} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    expenseByCategory,
    topCategories,
    dailySpending,
    monthlyTrend,
    savingsGoalProgress,
    totalDebt,
    monthlyDebtPayments,
    debtToIncomeRatio,
    monthsToDebtFree,
    loading,
    selectedMonth,
    setSelectedMonth,
  } = useAnalytics();

  const goToPreviousMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const goToNextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));

  const monthsOverBudget = monthlyTrend.filter(
    (m) => m.expenses > m.income && m.income > 0
  ).length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-56 animate-pulse rounded bg-muted" />
        </div>

        {/* Summary skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonChart height="h-[250px]" />
        <SkeletonChart />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-teal-600" />
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-[160px] items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {format(selectedMonth, "MMMM yyyy")}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Section 1: Monthly Summary ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Income
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {formatCurrency(totalIncome)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardDescription>
            <CardTitle className="text-2xl text-red-500">
              {formatCurrency(totalExpenses)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-blue-500" />
              Net Cash Flow
            </CardDescription>
            <CardTitle
              className={`text-2xl ${
                netCashFlow >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(netCashFlow)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4 text-amber-500" />
              Savings Rate
            </CardDescription>
            <CardTitle className="text-2xl">
              {savingsRate > 0 ? `${savingsRate.toFixed(1)}%` : "0%"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ── Section 2: Expense Breakdown ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensePieChart data={expenseByCategory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <CardDescription>Highest expense categories this month</CardDescription>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No expenses recorded this month
              </p>
            ) : (
              <div className="space-y-4">
                {topCategories.map((cat, index) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                          {index + 1}
                        </span>
                        <span className="font-medium">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {cat.percentage.toFixed(1)}%
                        </span>
                        <span className="font-medium">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Daily Spending ── */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Pattern</CardTitle>
          <CardDescription>
            Your spending distribution across the month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailySpendingChart data={dailySpending} />
        </CardContent>
      </Card>

      {/* ── Section 4: Income vs Expense Trend ── */}
      <Card>
        <CardHeader>
          <CardTitle>6-Month Trend</CardTitle>
          <CardDescription>Income vs expenses over time</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyTrendChart data={monthlyTrend} />
          {monthlyTrend.length > 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              {monthsOverBudget > 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Your expenses exceeded income in {monthsOverBudget} of the last
                  6 months
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Great job! Your income exceeded expenses in all of the last 6
                  months
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 5: Savings Progress ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-teal-600" />
            Savings Goals Progress
          </CardTitle>
          <CardDescription>Track your progress towards each goal</CardDescription>
        </CardHeader>
        <CardContent>
          {savingsGoalProgress.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No savings goals set up yet
            </p>
          ) : (
            <div className="space-y-5">
              {savingsGoalProgress.map((goal) => (
                <div key={goal.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={goal.percentage} className="flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {goal.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 6: Debt Health ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-red-500" />
              Total Debt Remaining
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(totalDebt)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-amber-500" />
              Monthly Debt Payments
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(monthlyDebtPayments)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle
                className={`h-4 w-4 ${
                  debtToIncomeRatio > 40 ? "text-red-500" : "text-amber-500"
                }`}
              />
              Debt-to-Income Ratio
            </CardDescription>
            <CardTitle
              className={`text-2xl ${
                debtToIncomeRatio > 40 ? "text-red-500" : ""
              }`}
            >
              {debtToIncomeRatio.toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-teal-500" />
              Months to Debt-Free
            </CardDescription>
            <CardTitle className="text-2xl">
              {monthsToDebtFree > 0 ? monthsToDebtFree : "--"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
