"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Debt, DebtPayment, DebtAllocation } from "@/types/database";
import { useSyncStore } from "@/lib/stores/sync-store";

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("*")
      .order("status", { ascending: true })
      .order("outstanding_balance", { ascending: false });
    if (!error && data) setDebts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts, syncVersion]);

  const deleteDebt = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (!error) setDebts((prev) => prev.filter((d) => d.id !== id));
    return { error };
  };

  const addPayment = async (
    debtId: string,
    amount: number,
    date: string,
    notes?: string,
    paymentMethod?: string
  ) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated") };

    // Use RPC to atomically create payment + auto-generate expense
    const { error } = await supabase.rpc("log_debt_payment_with_expense", {
      p_debt_id: debtId,
      p_user_id: user.id,
      p_amount: amount,
      p_date: date,
      p_notes: notes || null,
      p_payment_method: paymentMethod || "bank_transfer",
    });

    if (error) return { error };

    await fetchDebts();
    return { error: null };
  };

  const fetchPayments = async (debtId: string): Promise<DebtPayment[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debt_payments")
      .select("*")
      .eq("debt_id", debtId)
      .order("date", { ascending: false });
    if (error || !data) return [];
    return data;
  };

  const fetchAllocations = async (debtId: string): Promise<DebtAllocation[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debt_allocations")
      .select("*")
      .eq("debt_id", debtId)
      .order("date", { ascending: false });
    if (error || !data) return [];
    return data;
  };

  const activeDebtsList = useMemo(
    () => debts.filter((d) => d.status === "active"),
    [debts]
  );

  const totalDebt = useMemo(
    () => activeDebtsList.reduce((sum, d) => sum + d.outstanding_balance, 0),
    [activeDebtsList]
  );

  const activeDebts = activeDebtsList.length;

  const totalMonthlyEMI = useMemo(
    () =>
      activeDebtsList
        .filter((d) => d.emi_amount !== null)
        .reduce((sum, d) => sum + (d.emi_amount ?? 0), 0),
    [activeDebtsList]
  );

  const paidOffDebts = useMemo(
    () => debts.filter((d) => d.status === "paid_off").length,
    [debts]
  );

  return {
    debts,
    loading,
    fetchDebts,
    deleteDebt,
    addPayment,
    fetchPayments,
    fetchAllocations,
    activeDebtsList,
    totalDebt,
    activeDebts,
    totalMonthlyEMI,
    paidOffDebts,
  };
}
