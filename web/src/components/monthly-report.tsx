"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  getDate,
} from "date-fns";
import { Printer, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants/categories";
import type { IncomeEntry, ExpenseEntry } from "@/types/database";
import { Button } from "@/components/ui/button";

interface MonthlyReportProps {
  month: Date;
}

function getCategoryLabel(
  value: string,
  list: ReadonlyArray<{ value: string; label: string }>
): string {
  return list.find((c) => c.value === value)?.label ?? value;
}

export function MonthlyReport({ month }: MonthlyReportProps) {
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const mStart = format(startOfMonth(month), "yyyy-MM-dd");
    const mEnd = format(endOfMonth(month), "yyyy-MM-dd");

    const [incomeRes, expenseRes] = await Promise.all([
      supabase
        .from("income_entries")
        .select("*")
        .gte("date", mStart)
        .lte("date", mEnd)
        .order("date", { ascending: true }),
      supabase
        .from("expense_entries")
        .select("*")
        .gte("date", mStart)
        .lte("date", mEnd)
        .order("date", { ascending: true }),
    ]);

    if (incomeRes.data) setIncomeEntries(incomeRes.data);
    else setIncomeEntries([]);
    if (expenseRes.data) setExpenseEntries(expenseRes.data);
    else setExpenseEntries([]);

    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalIncome = useMemo(
    () => incomeEntries.reduce((s, e) => s + e.amount, 0),
    [incomeEntries]
  );
  const totalExpenses = useMemo(
    () => expenseEntries.reduce((s, e) => s + e.amount, 0),
    [expenseEntries]
  );
  const net = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : "0";

  // Top 5 expense categories
  const topExpenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenseEntries) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .map(([cat, amount]) => ({
        label: getCategoryLabel(cat, EXPENSE_CATEGORIES),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenseEntries]);

  // Top 3 income sources
  const topIncomeSources = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of incomeEntries) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .map(([cat, amount]) => ({
        label: getCategoryLabel(cat, INCOME_CATEGORIES),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [incomeEntries]);

  // Daily spending list
  const dailySpending = useMemo(() => {
    const dayMap: Record<number, { total: number; items: string[] }> = {};
    for (const e of expenseEntries) {
      const day = getDate(new Date(e.date));
      if (!dayMap[day]) dayMap[day] = { total: 0, items: [] };
      dayMap[day].total += e.amount;
      dayMap[day].items.push(`${e.payee_name} (${formatCurrency(e.amount)})`);
    }
    const daysInMonth = endOfMonth(month).getDate();
    const result: Array<{ day: number; total: number; items: string[] }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (dayMap[d]) {
        result.push({ day: d, ...dayMap[d] });
      }
    }
    return result;
  }, [expenseEntries, month]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const monthLabel = format(month, "MMMM yyyy");

  return (
    <div>
      {/* Print button — hidden in print */}
      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={handlePrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Printable content */}
      <div className="monthly-report-printable space-y-6 text-sm">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-xl font-bold">
            KomalFin Monthly Report — {monthLabel}
          </h1>
          <p className="mt-1 text-muted-foreground print:text-gray-500">
            Generated on {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>

        {/* Summary */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Summary</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground print:text-gray-500">
                Income
              </p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground print:text-gray-500">
                Expenses
              </p>
              <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground print:text-gray-500">
                Net
              </p>
              <p className={`text-lg font-bold ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(net)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground print:text-gray-500">
                Savings Rate
              </p>
              <p className="text-lg font-bold">{savingsRate}%</p>
            </div>
          </div>
        </div>

        {/* Top 5 expense categories */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Top 5 Expense Categories</h2>
          {topExpenseCategories.length === 0 ? (
            <p className="text-muted-foreground">No expenses this month.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {topExpenseCategories.map((cat, i) => (
                  <tr key={cat.label} className="border-b last:border-0">
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">{cat.label}</td>
                    <td className="py-1.5 text-right font-medium">
                      {formatCurrency(cat.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top 3 income sources */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Top 3 Income Sources</h2>
          {topIncomeSources.length === 0 ? (
            <p className="text-muted-foreground">No income this month.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {topIncomeSources.map((src, i) => (
                  <tr key={src.label} className="border-b last:border-0">
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">{src.label}</td>
                    <td className="py-1.5 text-right font-medium">
                      {formatCurrency(src.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Daily spending list */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Daily Spending</h2>
          {dailySpending.length === 0 ? (
            <p className="text-muted-foreground">No spending recorded this month.</p>
          ) : (
            <div className="space-y-2">
              {dailySpending.map((day) => (
                <div key={day.day} className="flex items-start gap-3 border-b pb-2 last:border-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {day.day}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground print:text-gray-500">
                      {day.items.join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatCurrency(day.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the report */
          body * {
            visibility: hidden;
          }
          .monthly-report-printable,
          .monthly-report-printable * {
            visibility: visible;
          }
          .monthly-report-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          /* Force colors in print */
          .text-emerald-600 {
            color: #059669 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-red-500 {
            color: #ef4444 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
