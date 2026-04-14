"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessClient } from "@/types/business";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useBusinessClients() {
  const [entries, setEntries] = useState<BusinessClient[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("business_clients")
      .select("*")
      .order("name", { ascending: true });
    if (!error && data) setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, syncVersion]);

  const deleteEntry = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("business_clients")
      .delete()
      .eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  const activeClients = useMemo(
    () => entries.filter((e) => e.status === "active"),
    [entries]
  );

  const totalMonthlyValue = useMemo(
    () =>
      activeClients.reduce(
        (sum, e) => sum + (e.monthly_value || 0),
        0
      ),
    [activeClients]
  );

  return {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    activeCount: activeClients.length,
    totalMonthlyValue,
  };
}
