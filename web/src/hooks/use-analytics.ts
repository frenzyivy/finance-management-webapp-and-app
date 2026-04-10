"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  IncomeEntry,
  ExpenseEntry,
  SavingsGoal,
  Debt,
} from "@/types/database";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  getDate,
} from "date-fns";

interface ExpenseByCategoryItem {
  category: string;
  label: string;
  amount: number;
  percentage: number;
}

interface DailySpendingItem {
  day: string;
  amount: number;
}

interface MonthlyTrendItem {
  month: string;
  income: number;
  expenses: number;
}

interface SavingsGoalProgressItem {
  name: string;
  current: number;
  target: number;
  percentage: number;
}

export function useAnalytics() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Raw data
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  // 6-month trend raw data
  const [trendIncome, setTrendIncome] = useState<IncomeEntry[]>([]);
  const [trendExpenses, setTrendExpenses] = useState<ExpenseEntry[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
    const sixMonthsAgo = format(
      startOfMonth(subMonths(selectedMonth, 5)),
      "yyyy-MM-dd"
    );

    const [
      incomeRes,
      expenseRes,
      goalsRes,
      debtsRes,
      trendIncomeRes,
      trendExpenseRes,
    ] = await Promise.all([
      supabase
        .from("income_entries")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false }),
      supabase
        .from("expense_entries")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false }),
      supabase.from("savings_goals").select("*"),
      supabase.from("debts").select("*"),
      supabase
        .from("income_entries")
        .select("*")
        .gte("date", sixMonthsAgo)
        .lte("date", monthEnd),
      supabase
        .from("expense_entries")
        .select("*")
        .gte("date", sixMonthsAgo)
        .lte("date", monthEnd),
    ]);

    if (incomeRes.data) setIncomeEntries(incomeRes.data);
    if (expenseRes.data) setExpenseEntries(expenseRes.data);
    if (goalsRes.data) setSavingsGoals(goalsRes.data);
    if (debtsRes.data) setDebts(debtsRes.data);
    if (trendIncomeRes.data) setTrendIncome(trendIncomeRes.data);
    if (trendExpenseRes.data) setTrendExpenses(trendExpenseRes.data);

    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Monthly Summary
  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

  // Expense Breakdown by Category
  const expenseByCategory: ExpenseByCategoryItem[] = (() => {
    const categoryMap: Record<string, number> = {};
    for (const entry of expenseEntries) {
      categoryMap[entry.category] =
        (categoryMap[entry.category] ?? 0) + entry.amount;
    }

    const items = Object.entries(categoryMap)
      .map(([category, amount]) => {
        const catInfo = EXPENSE_CATEGORIES.find((c) => c.value === category);
        return {
          category,
          label: catInfo?.label ?? category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return items;
  })();

  // Top 5 spending categories
  const topCategories = expenseByCategory.slice(0, 5);

  // Daily Spending Pattern
  const dailySpending: DailySpendingItem[] = (() => {
    const dayMap: Record<number, number> = {};
    for (const entry of expenseEntries) {
      const day = getDate(new Date(entry.date));
      dayMap[day] = (dayMap[day] ?? 0) + entry.amount;
    }

    const daysInMonth = endOfMonth(selectedMonth).getDate();
    const result: DailySpendingItem[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: String(d), amount: dayMap[d] ?? 0 });
    }
    return result;
  })();

  // Monthly Trend (last 6 months)
  const monthlyTrend: MonthlyTrendItem[] = (() => {
    const months: MonthlyTrendItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(selectedMonth, i);
      const mStart = format(startOfMonth(m), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(m), "yyyy-MM-dd");
      const monthLabel = format(m, "MMM yyyy");

      const income = trendIncome
        .filter((e) => e.date >= mStart && e.date <= mEnd)
        .reduce((sum, e) => sum + e.amount, 0);

      const expenses = trendExpenses
        .filter((e) => e.date >= mStart && e.date <= mEnd)
        .reduce((sum, e) => sum + e.amount, 0);

      months.push({ month: monthLabel, income, expenses });
    }
    return months;
  })();

  // Savings Progress
  const totalSaved = savingsGoals.reduce(
    (sum, g) => sum + g.current_balance,
    0
  );
  const savingsGoalProgress: SavingsGoalProgressItem[] = savingsGoals.map(
    (g) => ({
      name: g.name,
      current: g.current_balance,
      target: g.target_amount,
      percentage:
        g.target_amount > 0
          ? Math.min((g.current_balance / g.target_amount) * 100, 100)
          : 0,
    })
  );

  // Debt Health
  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce(
    (sum, d) => sum + d.outstanding_balance,
    0
  );
  const monthlyDebtPayments = activeDebts.reduce(
    (sum, d) => sum + (d.emi_amount ?? 0),
    0
  );
  const debtToIncomeRatio =
    totalIncome > 0 ? (monthlyDebtPayments / totalIncome) * 100 : 0;
  const monthsToDebtFree =
    monthlyDebtPayments > 0 ? Math.ceil(totalDebt / monthlyDebtPayments) : 0;

  return {
    // Monthly Summary
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,

    // Expense Breakdown
    expenseByCategory,
    topCategories,

    // Daily Spending
    dailySpending,

    // Trend
    monthlyTrend,

    // Savings
    totalSaved,
    savingsGoalProgress,

    // Debt Health
    totalDebt,
    monthlyDebtPayments,
    debtToIncomeRatio,
    monthsToDebtFree,

    // State
    loading,
    selectedMonth,
    setSelectedMonth,
  };
}
