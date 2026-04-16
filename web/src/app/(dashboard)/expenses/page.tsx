"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { formatMonth } from "@/lib/utils/date";

import { useExpenses } from "@/hooks/use-expenses";
import { ExpenseForm } from "@/components/forms/expense-form";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseEntry, ExpenseCategory, BudgetLimit } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { PageHeader, HeaderIconButton } from "@/components/layout/PageHeader";
import {
  SummaryBanner,
  TabSwitcher,
  MonthFilter,
  TransactionCard,
  InsightCard,
  formatINR,
} from "@/components/komal";

type TabKey = "all" | "rent" | "food_groceries" | "utilities" | "shopping";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "rent", label: "Rent" },
  { key: "food_groceries", label: "Food" },
  { key: "utilities", label: "Utilities" },
  { key: "shopping", label: "Shopping" },
];

// Map DB expense categories → CategoryIcon keys (defined in komal/CategoryIcon).
function mapCategoryKey(cat: ExpenseCategory): string {
  switch (cat) {
    case "food_groceries":
      return "food";
    case "credit_card_payments":
      return "credit_card";
    case "emis":
      return "emi";
    case "family_personal":
      return "family";
    case "debt_repayment":
      return "credit_card";
    default:
      return cat;
  }
}

function getCategoryLabel(cat: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function getPaymentLabel(m: string): string {
  return PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesPageInner />
    </Suspense>
  );
}

function ExpensesPageInner() {
  const searchParams = useSearchParams();
  const { entries, loading, fetchEntries, deleteEntry, availableMonths } = useExpenses();

  const [tab, setTab] = useState<TabKey>("all");
  const [monthFilter, setMonthFilter] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ExpenseEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>([]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(undefined);
      setFormOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("budget_limits").select("*");
      if (data) setBudgetLimits(data);
    })();
  }, []);

  const topAlert = useMemo(() => {
    if (!budgetLimits.length || !entries.length) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    for (const e of entries) {
      if (e.date >= monthStart) {
        totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount);
      }
    }
    let worst: {
      label: string;
      spent: number;
      limit: number;
      percent: number;
      level: "warning" | "danger";
    } | null = null;
    for (const bl of budgetLimits) {
      const spent = totals[bl.category] ?? 0;
      const percent = bl.monthly_limit > 0 ? (spent / bl.monthly_limit) * 100 : 0;
      const level = percent >= 100 ? "danger" : percent >= 80 ? "warning" : null;
      if (level) {
        const label =
          EXPENSE_CATEGORIES.find((c) => c.value === bl.category)?.label ?? bl.category;
        if (!worst || percent > worst.percent) {
          worst = { label, spent, limit: bl.monthly_limit, percent, level };
        }
      }
    }
    return worst;
  }, [budgetLimits, entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const catOk = tab === "all" || e.category === tab;
      const monthOk = monthFilter === "all" || e.date.startsWith(monthFilter);
      return catOk && monthOk;
    });
  }, [entries, tab, monthFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, e) => sum + Number(e.amount), 0),
    [filtered]
  );

  const bannerLabel = useMemo(() => {
    const monthLabel =
      monthFilter === "all" ? "All time" : formatMonth(parseISO(monthFilter + "-01"));
    const catLabel = tab === "all" ? null : TABS.find((t) => t.key === tab)?.label ?? null;
    return catLabel ? `${monthLabel} · ${catLabel}` : monthLabel;
  }, [monthFilter, tab]);

  const monthOptions = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    // Drop any months in the future (e.g. post-dated entries) so the pill row
    // always anchors on the current month and goes backward from there.
    const pastOrCurrent = availableMonths.filter((m) => m <= currentMonth);
    const withCurrent = pastOrCurrent.includes(currentMonth)
      ? pastOrCurrent
      : [currentMonth, ...pastOrCurrent].sort().reverse();
    // Ensure the currently selected month is always present.
    if (
      monthFilter !== "all" &&
      !withCurrent.includes(monthFilter)
    ) {
      return [monthFilter, ...withCurrent].sort().reverse();
    }
    return withCurrent;
  }, [availableMonths, monthFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete expense");
    else toast.success("Expense deleted");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Expenses"
          actions={
            <HeaderIconButton
              aria-label="Add expense"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </HeaderIconButton>
          }
        />
      </div>

      <div className="animate d2">
        <SummaryBanner
          label={bannerLabel}
          value={filteredTotal}
          tone="expense"
          emoji="💸"
        />
      </div>

      {topAlert ? (
        <div className="animate d3">
          <InsightCard emoji={topAlert.level === "danger" ? "⚠️" : "💡"}>
            {topAlert.level === "danger"
              ? `You've blown past your ${topAlert.label} budget — ${formatINR(topAlert.spent)} of ${formatINR(topAlert.limit)}.`
              : `You're at ${Math.round(topAlert.percent)}% of your ${topAlert.label} budget — ${formatINR(topAlert.spent)} of ${formatINR(topAlert.limit)}.`}
          </InsightCard>
        </div>
      ) : null}

      <div className="animate d4">
        <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="animate d4">
        <MonthFilter
          value={monthFilter}
          onChange={setMonthFilter}
          months={monthOptions}
        />
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-secondary)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-6 py-10 text-center text-[var(--text-secondary)] text-sm">
            No expenses match this view. Tap + to add one.
          </div>
        ) : (
          filtered.map((entry, idx) => (
            <div
              key={entry.id}
              className={`animate d${Math.min(idx + 5, 10)} mx-6`}
            >
              <TransactionCard
                name={entry.payee_name}
                kind="expense"
                category={mapCategoryKey(entry.category)}
                categoryLabel={getCategoryLabel(entry.category)}
                metaTag={
                  entry.is_auto_generated
                    ? "Auto"
                    : entry.funding_source === "debt_funded"
                    ? "Debt"
                    : entry.funding_source === "debt_repayment"
                    ? "EMI"
                    : entry.is_recurring
                    ? "Recurring"
                    : undefined
                }
                metaTagTone={entry.is_auto_generated ? "muted" : "default"}
                date={format(new Date(entry.date), "d MMM")}
                method={getPaymentLabel(entry.payment_method)}
                amount={entry.amount}
                onClick={() => {
                  setEditing(entry);
                  setFormOpen(true);
                }}
              />
            </div>
          ))
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this expense entry."
                : "Fill in the details to record a new expense."}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            entry={editing}
            onSuccess={() => {
              setFormOpen(false);
              setEditing(undefined);
              fetchEntries();
            }}
            onCancel={() => {
              setFormOpen(false);
              setEditing(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
