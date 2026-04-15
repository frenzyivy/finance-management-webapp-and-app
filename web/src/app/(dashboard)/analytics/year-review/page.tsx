"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  ArrowLeft,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants/categories";
import type { IncomeEntry, ExpenseEntry } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Helpers ──

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCategoryLabel(
  value: string,
  list: ReadonlyArray<{ value: string; label: string }>
): string {
  return list.find((c) => c.value === value)?.label ?? value;
}

interface MonthRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
}

interface CategoryRank {
  category: string;
  label: string;
  amount: number;
  percentage: number;
}

// ── Custom Tooltip for AreaChart ──

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === "income" ? "Income" : "Expenses"}:{" "}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Loading skeleton ──

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-60 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <div className="space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-[400px] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

// ── Main Page ──

export default function YearReviewPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const yearDate = new Date(selectedYear, 0, 1);
    const yearStart = format(startOfYear(yearDate), "yyyy-MM-dd");
    const yearEnd = format(endOfYear(yearDate), "yyyy-MM-dd");

    const [incomeRes, expenseRes] = await Promise.all([
      supabase
        .from("income_entries")
        .select("*")
        .gte("date", yearStart)
        .lte("date", yearEnd)
        .order("date", { ascending: true }),
      supabase
        .from("expense_entries")
        .select("*")
        .gte("date", yearStart)
        .lte("date", yearEnd)
        .order("date", { ascending: true }),
    ]);

    if (incomeRes.data) setIncomeEntries(incomeRes.data);
    else setIncomeEntries([]);
    if (expenseRes.data) setExpenseEntries(expenseRes.data);
    else setExpenseEntries([]);

    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Computed values ──

  const totalIncome = useMemo(
    () => incomeEntries.reduce((s, e) => s + e.amount, 0),
    [incomeEntries]
  );
  const totalExpenses = useMemo(
    () => expenseEntries.reduce((s, e) => s + e.amount, 0),
    [expenseEntries]
  );
  const totalSaved = totalIncome - totalExpenses;
  const monthlyAvgSpending = totalExpenses / 12;

  // Monthly breakdown
  const monthlyRows: MonthRow[] = useMemo(() => {
    return MONTH_NAMES.map((name, i) => {
      const mStart = format(startOfMonth(new Date(selectedYear, i, 1)), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(new Date(selectedYear, i, 1)), "yyyy-MM-dd");

      const income = incomeEntries
        .filter((e) => e.date >= mStart && e.date <= mEnd)
        .reduce((s, e) => s + e.amount, 0);
      const expenses = expenseEntries
        .filter((e) => e.date >= mStart && e.date <= mEnd)
        .reduce((s, e) => s + e.amount, 0);
      const net = income - expenses;
      const savingsRate = income > 0 ? (net / income) * 100 : 0;

      return { month: name, income, expenses, net, savingsRate };
    });
  }, [incomeEntries, expenseEntries, selectedYear]);

  // Best / worst month indices
  const bestMonthIdx = useMemo(() => {
    let idx = 0;
    for (let i = 1; i < monthlyRows.length; i++) {
      if (monthlyRows[i].net > monthlyRows[idx].net) idx = i;
    }
    return idx;
  }, [monthlyRows]);

  const worstMonthIdx = useMemo(() => {
    let idx = 0;
    for (let i = 1; i < monthlyRows.length; i++) {
      if (monthlyRows[i].net < monthlyRows[idx].net) idx = i;
    }
    return idx;
  }, [monthlyRows]);

  // Top spending categories
  const expenseCategories: CategoryRank[] = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenseEntries) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        label: getCategoryLabel(category, EXPENSE_CATEGORIES),
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenseEntries, totalExpenses]);

  // Income sources
  const incomeCategories: CategoryRank[] = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of incomeEntries) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        label: getCategoryLabel(category, INCOME_CATEGORIES),
        amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeEntries, totalIncome]);

  // Chart data
  const chartData = useMemo(
    () =>
      monthlyRows.map((r) => ({
        month: r.month.slice(0, 3),
        income: r.income,
        expenses: r.expenses,
      })),
    [monthlyRows]
  );

  // ── Insights ──

  const insights = useMemo(() => {
    const lines: string[] = [];

    // Highest earning month
    const highEarn = monthlyRows.reduce((best, r) =>
      r.income > best.income ? r : best
    );
    if (highEarn.income > 0) {
      lines.push(
        `Your highest earning month was ${highEarn.month} with ${formatCurrency(highEarn.income)}.`
      );
    }

    // Highest spending month
    const highSpend = monthlyRows.reduce((best, r) =>
      r.expenses > best.expenses ? r : best
    );
    if (highSpend.expenses > 0) {
      lines.push(
        `You spent the most in ${highSpend.month} (${formatCurrency(highSpend.expenses)}).`
      );
    }

    // Best saving month
    const bestSave = monthlyRows.reduce((best, r) =>
      r.net > best.net ? r : best
    );
    if (bestSave.net > 0) {
      lines.push(
        `Your best saving month was ${bestSave.month} — you saved ${formatCurrency(bestSave.net)}.`
      );
    }

    // Most consistent expense category
    if (expenseCategories.length > 0) {
      const top = expenseCategories[0];
      const avgPerMonth = top.amount / 12;
      lines.push(
        `Your most consistent expense was ${top.label} at ${formatCurrency(avgPerMonth)}/month average.`
      );
    }

    // Savings rate improvement: first half vs second half
    const firstHalf = monthlyRows.slice(0, 6);
    const secondHalf = monthlyRows.slice(6, 12);
    const fhIncome = firstHalf.reduce((s, r) => s + r.income, 0);
    const fhExpenses = firstHalf.reduce((s, r) => s + r.expenses, 0);
    const shIncome = secondHalf.reduce((s, r) => s + r.income, 0);
    const shExpenses = secondHalf.reduce((s, r) => s + r.expenses, 0);
    const fhRate = fhIncome > 0 ? ((fhIncome - fhExpenses) / fhIncome) * 100 : 0;
    const shRate = shIncome > 0 ? ((shIncome - shExpenses) / shIncome) * 100 : 0;

    if (fhIncome > 0 && shIncome > 0) {
      if (shRate > fhRate) {
        lines.push(
          `You improved your savings rate from ${fhRate.toFixed(1)}% to ${shRate.toFixed(1)}% over the year.`
        );
      } else if (shRate < fhRate) {
        lines.push(
          `Your savings rate went from ${fhRate.toFixed(1)}% in H1 to ${shRate.toFixed(1)}% in H2.`
        );
      } else {
        lines.push(
          `Your savings rate held steady at ${fhRate.toFixed(1)}% across both halves of the year.`
        );
      }
    }

    return lines;
  }, [monthlyRows, expenseCategories]);

  if (loading) return <Skeleton />;

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title={`Year in Review — ${selectedYear}`}
          eyebrow="12-month snapshot"
        />
      </div>
      <div className="px-6 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/analytics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-[100px] items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
            {selectedYear}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Section 1: Annual Summary ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Annual Income
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
              Total Annual Expenses
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
              Total Saved
            </CardDescription>
            <CardTitle
              className={cn(
                "text-2xl",
                totalSaved >= 0 ? "text-emerald-600" : "text-red-500"
              )}
            >
              {formatCurrency(totalSaved)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-amber-500" />
              Monthly Avg Spending
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(monthlyAvgSpending)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ── Section 2: Monthly Breakdown Table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>
            Income, expenses, and savings for each month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Savings Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.map((row, i) => (
                <TableRow
                  key={row.month}
                  className={cn(
                    i === bestMonthIdx && row.net !== 0 && "bg-emerald-50/60 dark:bg-emerald-950/30",
                    i === worstMonthIdx && row.net !== 0 && bestMonthIdx !== worstMonthIdx && "bg-red-50/60 dark:bg-red-950/30"
                  )}
                >
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {formatCurrency(row.income)}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    {formatCurrency(row.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      row.net >= 0 ? "text-emerald-600" : "text-red-500"
                    )}
                  >
                    {formatCurrency(row.net)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.income > 0 ? `${row.savingsRate.toFixed(1)}%` : "--"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">
                  {formatCurrency(totalIncome)}
                </TableCell>
                <TableCell className="text-right font-bold text-red-500">
                  {formatCurrency(totalExpenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-bold",
                    totalSaved >= 0 ? "text-emerald-600" : "text-red-500"
                  )}
                >
                  {formatCurrency(totalSaved)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {totalIncome > 0
                    ? `${((totalSaved / totalIncome) * 100).toFixed(1)}%`
                    : "--"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* ── Section 3 & 4: Categories side by side ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Spending Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <CardDescription>Where your money went this year</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No expenses recorded this year
              </p>
            ) : (
              <div className="space-y-4">
                {expenseCategories.map((cat, index) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
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
                        className="h-full rounded-full bg-red-400 transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Income Sources</CardTitle>
            <CardDescription>Where your money came from this year</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeCategories.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No income recorded this year
              </p>
            ) : (
              <div className="space-y-4">
                {incomeCategories.map((cat, index) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
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
                        className="h-full rounded-full bg-emerald-400 transition-all"
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

      {/* ── Section 5: Monthly Trend Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Income vs Expenses</CardTitle>
          <CardDescription>Full-year trend at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.every((d) => d.income === 0 && d.expenses === 0) ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No data available for this year
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) =>
                    value === "income" ? "Income" : "Expenses"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Section 6: Key Insights ── */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Key Insights
            </CardTitle>
            <CardDescription>
              Automatically generated from your {selectedYear} data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {insights.map((line, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
