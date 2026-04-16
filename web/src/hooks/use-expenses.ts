"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseEntry, ExpenseCategory } from "@/types/database";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useExpenses() {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("expense_entries")
      .select("*")
      .order("date", { ascending: false });
    if (!error && data) setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, syncVersion]);

  const deleteEntry = async (id: string) => {
    const supabase = createClient();

    // Check if expense is linked to a debt — use cascade-aware RPC
    const expense = entries.find((e) => e.id === id);
    const isDebtLinked =
      expense &&
      (expense.funding_source !== "own_funds" ||
        expense.source_debt_payment_id ||
        expense.linked_debt_id);

    if (isDebtLinked) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: new Error("Not authenticated") };

      const { error } = await supabase.rpc("delete_expense_with_cascade", {
        p_expense_id: id,
        p_user_id: user.id,
      });
      if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
      return { error };
    }

    // Regular delete for non-linked expenses
    const { error } = await supabase
      .from("expense_entries")
      .delete()
      .eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  // Calculate summary stats for current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const thisMonthEntries = entries.filter((e) => e.date >= monthStart);

  const totalThisMonth = thisMonthEntries.reduce(
    (sum, e) => sum + e.amount,
    0
  );

  const monthEntryCount = thisMonthEntries.length;

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const topCategory = useMemo(() => {
    if (thisMonthEntries.length === 0) return null;

    const categoryTotals: Partial<Record<ExpenseCategory, number>> = {};
    for (const entry of thisMonthEntries) {
      categoryTotals[entry.category] =
        (categoryTotals[entry.category] ?? 0) + entry.amount;
    }

    let maxCategory: ExpenseCategory | null = null;
    let maxAmount = 0;
    for (const [cat, total] of Object.entries(categoryTotals)) {
      if (total > maxAmount) {
        maxAmount = total;
        maxCategory = cat as ExpenseCategory;
      }
    }

    if (!maxCategory) return null;

    const label =
      EXPENSE_CATEGORIES.find((c) => c.value === maxCategory)?.label ??
      maxCategory;

    return { category: maxCategory, label, amount: maxAmount };
  }, [thisMonthEntries]);

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    totalThisMonth,
    monthEntryCount,
    topCategory,
    availableMonths,
  };
}
