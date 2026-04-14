"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessExpense } from "@/types/business";
import { useSyncStore } from "@/lib/stores/sync-store";
import { BUSINESS_EXPENSE_CATEGORIES } from "@/lib/constants/business-categories";

export function useBusinessExpenses() {
  const [entries, setEntries] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_expenses")
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
    const { error } = await supabase
      .from("business_expenses")
      .delete()
      .eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const thisMonthEntries = entries.filter((e) => e.date >= monthStart);
  const totalThisMonth = thisMonthEntries.reduce(
    (sum, e) => sum + e.amount,
    0
  );

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of thisMonthEntries) {
      map[e.category] = (map[e.category] || 0) + e.amount;
    }
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        label:
          BUSINESS_EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ||
          category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [thisMonthEntries]);

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    totalThisMonth,
    monthEntryCount: thisMonthEntries.length,
    categoryBreakdown,
  };
}
