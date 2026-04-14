"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessIncome } from "@/types/business";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useBusinessIncome() {
  const [entries, setEntries] = useState<BusinessIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_income")
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
      .from("business_income")
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
  const avgPerEntry =
    thisMonthEntries.length > 0 ? totalThisMonth / thisMonthEntries.length : 0;

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    totalThisMonth,
    monthEntryCount: thisMonthEntries.length,
    avgPerEntry,
  };
}
