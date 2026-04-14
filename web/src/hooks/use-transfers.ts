"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PersonalBusinessTransfer } from "@/types/business";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useTransfers() {
  const [entries, setEntries] = useState<PersonalBusinessTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("personal_business_transfers")
      .select("*")
      .order("date", { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, syncVersion]);

  const deleteEntry = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("personal_business_transfers")
      .delete()
      .eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  // This month's net flow
  const { personalToBusiness, businessToPersonal, netFlow } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const thisMonth = entries.filter((e) => e.date >= monthStart);
    const p2b = thisMonth
      .filter((e) => e.direction === "personal_to_business")
      .reduce((sum, e) => sum + e.amount, 0);
    const b2p = thisMonth
      .filter((e) => e.direction === "business_to_personal")
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      personalToBusiness: p2b,
      businessToPersonal: b2p,
      netFlow: b2p - p2b, // positive = money flowed to personal
    };
  }, [entries]);

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    personalToBusiness,
    businessToPersonal,
    netFlow,
  };
}