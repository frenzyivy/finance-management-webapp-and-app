"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Debt, DebtPayment } from "@/types/database";

export function useDebts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [fetchDebts]);

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
    notes?: string
  ) => {
    const supabase = createClient();

    // Insert payment
    const { error: paymentError } = await supabase
      .from("debt_payments")
      .insert({
        debt_id: debtId,
        amount,
        date,
        notes: notes || null,
      });
    if (paymentError) return { error: paymentError };

    // Find current debt
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return { error: new Error("Debt not found") };

    const newBalance = Math.max(0, debt.outstanding_balance - amount);
    const newStatus = newBalance <= 0 ? "paid_off" : debt.status;
    const newRemainingEmis =
      debt.emi_amount && debt.remaining_emis !== null
        ? Math.max(0, debt.remaining_emis - 1)
        : debt.remaining_emis;

    const { error: updateError } = await supabase
      .from("debts")
      .update({
        outstanding_balance: newBalance,
        status: newStatus,
        remaining_emis: newRemainingEmis,
      })
      .eq("id", debtId);

    if (updateError) return { error: updateError };

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
    totalDebt,
    activeDebts,
    totalMonthlyEMI,
    paidOffDebts,
  };
}
