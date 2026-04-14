"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessSubscriptionWithSpend } from "@/types/business";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useBusinessSubscriptions() {
  const [entries, setEntries] = useState<BusinessSubscriptionWithSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [subsRes, spendRes] = await Promise.all([
      supabase
        .from("business_subscriptions")
        .select("*")
        .order("next_renewal_date", { ascending: true }),
      supabase
        .from("business_subscription_spend_mtd")
        .select("id, actual_spend_mtd, expense_count_mtd"),
    ]);

    if (!subsRes.error && subsRes.data) {
      const spendById = new Map<string, { actual_spend_mtd: number; expense_count_mtd: number }>();
      for (const row of spendRes.data ?? []) {
        spendById.set(row.id, {
          actual_spend_mtd: Number(row.actual_spend_mtd) || 0,
          expense_count_mtd: Number(row.expense_count_mtd) || 0,
        });
      }
      const merged: BusinessSubscriptionWithSpend[] = subsRes.data.map((s) => ({
        ...s,
        actual_spend_mtd: spendById.get(s.id)?.actual_spend_mtd ?? 0,
        expense_count_mtd: spendById.get(s.id)?.expense_count_mtd ?? 0,
      }));
      setEntries(merged);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, syncVersion]);

  const deleteEntry = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("business_subscriptions")
      .delete()
      .eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  const activeEntries = useMemo(
    () => entries.filter((e) => e.status === "active"),
    [entries]
  );

  const monthlyBurn = useMemo(
    () =>
      activeEntries.reduce(
        (sum, e) => sum + (e.monthly_equivalent || 0),
        0
      ),
    [activeEntries]
  );

  const actualSpendMtd = useMemo(
    () => entries.reduce((sum, e) => sum + (e.actual_spend_mtd || 0), 0),
    [entries]
  );

  const essentialCount = useMemo(
    () => activeEntries.filter((e) => e.is_essential).length,
    [activeEntries]
  );

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    activeCount: activeEntries.length,
    monthlyBurn,
    actualSpendMtd,
    essentialCount,
    nonEssentialCount: activeEntries.length - essentialCount,
  };
}
