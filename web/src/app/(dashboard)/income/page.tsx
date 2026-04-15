"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

import { useIncome } from "@/hooks/use-income";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants/categories";
import type { IncomeEntry } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IncomeForm } from "@/components/forms/income-form";

import { PageHeader, HeaderIconButton } from "@/components/layout/PageHeader";
import {
  SummaryBanner,
  TabSwitcher,
  TransactionCard,
  SectionHeader,
  CategoryBreakdownRow,
  CATEGORY_COLORS,
  formatINR,
} from "@/components/komal";

type TabKey = "all" | "salary" | "freelance" | "side_income" | "other";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "salary", label: "Salary" },
  { key: "freelance", label: "Freelance" },
  { key: "side_income", label: "Side Income" },
  { key: "other", label: "Other" },
];

function getCategoryLabel(value: string) {
  return INCOME_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getPaymentLabel(value: string) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export default function IncomePage() {
  return (
    <Suspense fallback={null}>
      <IncomePageInner />
    </Suspense>
  );
}

function IncomePageInner() {
  const searchParams = useSearchParams();
  const { entries, loading, fetchEntries, deleteEntry, totalThisMonth } = useIncome();
  const [tab, setTab] = useState<TabKey>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<IncomeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(undefined);
      setFormOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (tab === "all") return entries;
    return entries.filter((e) => e.category === tab);
  }, [entries, tab]);

  const sources = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      totals.set(e.category, (totals.get(e.category) || 0) + Number(e.amount));
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
    return [...totals.entries()]
      .map(([cat, amt]) => ({
        cat,
        amt,
        percent: (amt / sum) * 100,
      }))
      .sort((a, b) => b.amt - a.amt);
  }, [entries]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete entry");
    else toast.success("Income entry deleted");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Income"
          actions={
            <HeaderIconButton
              aria-label="Add income"
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
          label="This Month"
          value={totalThisMonth}
          tone="income"
          emoji="💰"
        />
      </div>

      <div className="animate d3">
        <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text-secondary)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-6 py-10 text-center text-[var(--text-secondary)] text-sm">
            No entries yet. Tap + to add your first income.
          </div>
        ) : (
          filtered.map((entry, idx) => (
            <div
              key={entry.id}
              className={`animate d${Math.min(idx + 4, 10)} mx-6`}
            >
              <TransactionCard
                name={entry.source_name}
                kind="income"
                category={entry.category}
                categoryLabel={getCategoryLabel(entry.category)}
                metaTag={
                  entry.is_auto_generated
                    ? "Auto"
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

      {sources.length > 0 && (
        <>
          <div className="animate d6">
            <SectionHeader title="Sources" />
          </div>
          {sources.map((s, idx) => (
            <div
              key={s.cat}
              className={`animate d${Math.min(idx + 7, 10)}`}
            >
              <CategoryBreakdownRow
                name={getCategoryLabel(s.cat)}
                color={CATEGORY_COLORS[s.cat] || "#0D9373"}
                amount={s.amt}
                percent={s.percent}
              />
            </div>
          ))}
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Income Entry" : "Add Income Entry"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this income entry."
                : "Fill in the details to record a new income entry."}
            </DialogDescription>
          </DialogHeader>
          <IncomeForm
            key={editing?.id ?? "new"}
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
            <DialogTitle>Delete Income Entry</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deleteTarget?.source_name}&rdquo; for{" "}
              {deleteTarget ? formatINR(deleteTarget.amount) : ""}? This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
