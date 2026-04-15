"use client";

import { useState } from "react";
import { addMonths, subMonths, format } from "date-fns";

import { useAnalytics } from "@/hooks/use-analytics";
import { PageHeader, HeaderIconButton } from "@/components/layout/PageHeader";
import {
  ChartCard,
  DebtHealthGrid,
  CategoryBreakdownRow,
  CATEGORY_COLORS,
  SectionHeader,
  InsightCard,
  formatINR,
} from "@/components/komal";

import { ExpensePieChart } from "@/components/charts/expense-pie-chart";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend-chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonthlyReport } from "@/components/monthly-report";

function CategoryKey(cat: string): string {
  switch (cat) {
    case "food_groceries":
      return "food";
    case "credit_card_payments":
    case "emis":
    case "debt_repayment":
      return cat === "credit_card_payments" ? "credit_card" : cat === "emis" ? "emi" : "credit_card";
    case "family_personal":
      return "family";
    default:
      return cat;
  }
}

export default function AnalyticsPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    expenseByCategory,
    topCategories,
    monthlyTrend,
    totalDebt,
    monthlyDebtPayments,
    debtToIncomeRatio,
    monthsToDebtFree,
    loading,
    selectedMonth,
    setSelectedMonth,
  } = useAnalytics();

  const monthsOverBudget = monthlyTrend.filter(
    (m) => m.expenses > m.income && m.income > 0
  ).length;

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Analytics"
          actions={
            <>
              <HeaderIconButton
                aria-label="Previous month"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </HeaderIconButton>
              <HeaderIconButton
                aria-label="Next month"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </HeaderIconButton>
              <HeaderIconButton
                aria-label="Monthly report"
                onClick={() => setReportOpen(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6M9 15v-3M12 18v-6M15 18v-4" />
                </svg>
              </HeaderIconButton>
            </>
          }
        />
        <div className="px-6 mb-4 text-[13px] text-[var(--text-secondary)]">
          {format(selectedMonth, "MMMM yyyy")}
        </div>
      </div>

      {loading ? (
        <div className="mx-6 h-40 rounded-[16px] bg-[var(--surface-alt)] animate-pulse" />
      ) : (
        <>
          <div className="animate d2">
            <ChartCard
              title="Monthly Summary"
              subtitle={`${format(selectedMonth, "MMMM")} overview`}
              legend={[
                { color: "#0D9373", label: "Income" },
                { color: "#E8453C", label: "Expense" },
              ]}
            >
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Income" value={totalIncome} tone="income" />
                <MiniStat label="Expense" value={totalExpenses} tone="expense" />
                <MiniStat
                  label="Net"
                  value={netCashFlow}
                  tone={netCashFlow < 0 ? "expense" : "income"}
                />
                <MiniStat
                  label="Save rate"
                  value={`${savingsRate > 0 ? savingsRate.toFixed(1) : 0}%`}
                  tone="neutral"
                />
              </div>
            </ChartCard>
          </div>

          <div className="animate d3">
            <ChartCard
              title="6-Month Trend"
              subtitle="Income vs expenses"
              legend={[
                { color: "#0D9373", label: "Income" },
                { color: "#E8453C", label: "Expense" },
              ]}
            >
              <div style={{ height: 220 }}>
                <MonthlyTrendChart data={monthlyTrend} />
              </div>
            </ChartCard>
          </div>

          {monthlyTrend.length > 0 ? (
            <div className="animate d4">
              <InsightCard emoji={monthsOverBudget > 0 ? "⚠️" : "🎉"}>
                {monthsOverBudget > 0
                  ? `Expenses topped income in ${monthsOverBudget} of the last 6 months. Time to trim.`
                  : "Income beat expenses in every one of the last 6 months — nicely done."}
              </InsightCard>
            </div>
          ) : null}

          <div className="animate d5">
            <ChartCard title="Expense Breakdown" subtitle="Where your money goes">
              <div style={{ height: 240 }}>
                <ExpensePieChart data={expenseByCategory} />
              </div>
            </ChartCard>
          </div>

          <div className="animate d6">
            <SectionHeader title="Debt Health" />
          </div>
          <div className="animate d7">
            <DebtHealthGrid
              metrics={[
                { label: "Total Debt", value: formatINR(totalDebt), tone: "red" },
                {
                  label: "Monthly Pay",
                  value: formatINR(monthlyDebtPayments),
                  tone: "dark",
                },
                {
                  label: "Debt / Income",
                  value: `${debtToIncomeRatio.toFixed(1)}%`,
                  tone: debtToIncomeRatio > 40 ? "red" : "warn",
                },
                {
                  label: "Debt-Free In",
                  value: monthsToDebtFree > 0 ? `${monthsToDebtFree} mo` : "—",
                  tone: "dark",
                },
              ]}
            />
          </div>

          <div className="animate d8">
            <SectionHeader
              title="Top Categories"
              right={
                <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  {format(selectedMonth, "MMM yyyy")}
                </span>
              }
            />
          </div>
          {topCategories.length === 0 ? (
            <div className="mx-6 py-6 text-center text-[var(--text-secondary)] text-sm">
              No expenses recorded this month.
            </div>
          ) : (
            topCategories.map((c, idx) => (
              <div
                key={c.category}
                className={`animate d${Math.min(idx + 9, 10)}`}
              >
                <CategoryBreakdownRow
                  name={c.label}
                  color={CATEGORY_COLORS[CategoryKey(c.category)] || "#0D9373"}
                  amount={c.amount}
                  percent={c.percentage}
                />
              </div>
            ))
          )}
        </>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Monthly Report — {format(selectedMonth, "MMMM yyyy")}
            </DialogTitle>
          </DialogHeader>
          <MonthlyReport month={selectedMonth} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "income" | "expense" | "neutral";
}) {
  const color =
    tone === "income"
      ? "var(--accent)"
      : tone === "expense"
      ? "var(--expense)"
      : "var(--text-primary)";
  const display = typeof value === "number" ? formatINR(value) : value;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "var(--surface-alt)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color,
          marginTop: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {display}
      </div>
    </div>
  );
}
