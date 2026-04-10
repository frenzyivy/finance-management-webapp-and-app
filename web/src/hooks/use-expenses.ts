"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseEntry, ExpenseCategory } from "@/types/database";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";

export function useExpenses() {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [fetchEntries]);

  const deleteEntry = async (id: string) => {
    const supabase = createClient();
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
  };
}
