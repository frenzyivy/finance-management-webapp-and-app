"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  BnplPlatform,
  BnplPlatformWithStats,
  BnplPurchase,
  BnplPayment,
  BnplBill,
  BnplBillWithPayments,
  BnplBillPaymentItem,
  BnplUpcomingEMI,
  BnplInterestRateType,
} from "@/types/bnpl";
import { useSyncStore } from "@/lib/stores/sync-store";
import { BNPL_TO_EXPENSE_CATEGORY } from "@/lib/constants/categories";

export function useBnpl() {
  const [platforms, setPlatforms] = useState<BnplPlatformWithStats[]>([]);
  const [purchases, setPurchases] = useState<BnplPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const incrementSync = useSyncStore((s) => s.incrementSyncVersion);

  // ── Reads ──

  const fetchPlatforms = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bnpl_platforms_with_stats")
      .select("*")
      .order("status", { ascending: true })
      .order("name", { ascending: true });
    if (!error && data) setPlatforms(data);
  }, []);

  const fetchPurchases = useCallback(async (platformId?: string) => {
    const supabase = createClient();
    let query = supabase
      .from("bnpl_purchases")
      .select("*")
      .order("status", { ascending: true })
      .order("purchase_date", { ascending: false });
    if (platformId) query = query.eq("platform_id", platformId);
    const { data, error } = await query;
    if (!error && data) setPurchases(data);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPlatforms(), fetchPurchases()]);
    setLoading(false);
  }, [fetchPlatforms, fetchPurchases]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, syncVersion]);

  const fetchPayments = async (purchaseId: string): Promise<BnplPayment[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bnpl_payments")
      .select("*")
      .eq("purchase_id", purchaseId)
      .order("emi_number", { ascending: true });
    if (error || !data) return [];
    return data;
  };

  const fetchUpcomingEMIs = async (
    days: number = 30
  ): Promise<BnplUpcomingEMI[]> => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const futureDate = new Date(Date.now() + days * 86400000)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("bnpl_payments")
      .select(
        `
        id,
        purchase_id,
        emi_number,
        amount,
        due_date,
        status,
        bnpl_purchases!inner (
          item_name,
          total_emis,
          platform_id,
          bnpl_platforms!inner (
            name,
            color
          )
        )
      `
      )
      .in("status", ["upcoming", "due", "overdue"])
      .lte("due_date", futureDate)
      .order("due_date", { ascending: true });

    if (error || !data) return [];

    return data.map((p: Record<string, unknown>) => {
      const purchase = p.bnpl_purchases as Record<string, unknown>;
      const platform = purchase.bnpl_platforms as Record<string, unknown>;
      return {
        payment_id: p.id as string,
        purchase_id: p.purchase_id as string,
        platform_name: platform.name as string,
        platform_color: platform.color as string,
        item_name: purchase.item_name as string,
        emi_number: p.emi_number as number,
        total_emis: purchase.total_emis as number,
        amount: p.amount as number,
        due_date: p.due_date as string,
        status: p.status as BnplUpcomingEMI["status"],
      };
    });
  };

  // ── Platform CRUD ──

  const addPlatform = async (
    data: Omit<BnplPlatform, "id" | "user_id" | "created_at" | "updated_at">
  ) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase.from("bnpl_platforms").insert({
      ...data,
      user_id: user.id,
    });

    if (!error) {
      await fetchPlatforms();
      incrementSync();
    }
    return { error };
  };

  const updatePlatform = async (
    id: string,
    data: Partial<
      Pick<BnplPlatform, "name" | "platform_type" | "credit_limit" | "billing_day" | "color" | "status" | "notes">
    >
  ) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("bnpl_platforms")
      .update(data)
      .eq("id", id);

    if (!error) {
      await fetchPlatforms();
      incrementSync();
    }
    return { error };
  };

  const deletePlatform = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("bnpl_platforms")
      .delete()
      .eq("id", id);

    if (!error) {
      setPlatforms((prev) => prev.filter((p) => p.id !== id));
      setPurchases((prev) => prev.filter((p) => p.platform_id !== id));
      incrementSync();
    }
    return { error };
  };

  // ── Purchase operations ──

  const addPurchase = async (params: {
    platform_id: string;
    item_name: string;
    item_category: string;
    order_id?: string;
    merchant_name?: string;
    total_amount: number;
    down_payment: number;
    interest_rate: number;
    interest_rate_type: BnplInterestRateType;
    processing_fee: number;
    total_payable: number;
    emi_amount: number;
    total_emis: number;
    purchase_date: string;
    first_emi_date: string;
    emi_day_of_month: number;
    is_business_purchase?: boolean;
    notes?: string;
  }) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated"), data: null };

    const expenseCategory =
      BNPL_TO_EXPENSE_CATEGORY[params.item_category] || "miscellaneous";

    const { data, error } = await supabase.rpc(
      "create_bnpl_purchase_with_schedule",
      {
        p_user_id: user.id,
        p_platform_id: params.platform_id,
        p_item_name: params.item_name,
        p_item_category: params.item_category,
        p_order_id: params.order_id || null,
        p_merchant_name: params.merchant_name || null,
        p_total_amount: params.total_amount,
        p_down_payment: params.down_payment,
        p_interest_rate: params.interest_rate,
        p_interest_rate_type: params.interest_rate_type,
        p_processing_fee: params.processing_fee,
        p_total_payable: params.total_payable,
        p_emi_amount: params.emi_amount,
        p_total_emis: params.total_emis,
        p_purchase_date: params.purchase_date,
        p_first_emi_date: params.first_emi_date,
        p_emi_day_of_month: params.emi_day_of_month,
        p_is_business_purchase: params.is_business_purchase || false,
        p_notes: params.notes || null,
        p_expense_category: expenseCategory,
        p_expense_sub_category: params.item_name,
      }
    );

    if (!error) {
      await fetchAll();
      incrementSync();
    }
    return { error, data };
  };

  const deletePurchase = async (purchaseId: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase.rpc("delete_bnpl_purchase_with_cascade", {
      p_purchase_id: purchaseId,
      p_user_id: user.id,
    });

    if (!error) {
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
      await fetchPlatforms();
      incrementSync();
    }
    return { error };
  };

  // ── Payment operations ──

  const payEMI = async (
    paymentId: string,
    paidDate: string,
    paymentMethod: string = "upi",
    notes?: string
  ) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated"), data: null };

    const { data, error } = await supabase.rpc(
      "log_bnpl_payment_with_expense",
      {
        p_payment_id: paymentId,
        p_user_id: user.id,
        p_paid_date: paidDate,
        p_payment_method: paymentMethod,
        p_notes: notes || null,
      }
    );

    if (!error) {
      await fetchAll();
      incrementSync();
    }
    return { error, data };
  };

  const foreclosePurchase = async (
    purchaseId: string,
    foreclosureAmount?: number,
    paidDate: string = new Date().toISOString().split("T")[0],
    paymentMethod: string = "bank_transfer",
    notes?: string
  ) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated"), data: null };

    const { data, error } = await supabase.rpc("foreclose_bnpl_purchase", {
      p_purchase_id: purchaseId,
      p_user_id: user.id,
      p_foreclosure_amount: foreclosureAmount || null,
      p_paid_date: paidDate,
      p_payment_method: paymentMethod,
      p_notes: notes || null,
    });

    if (!error) {
      await fetchAll();
      incrementSync();
    }
    return { error, data };
  };

  // ── Bill operations ──

  const fetchBills = async (platformId: string): Promise<BnplBill[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bnpl_bills")
      .select("*")
      .eq("platform_id", platformId)
      .order("bill_year", { ascending: false })
      .order("bill_month", { ascending: false });
    if (error || !data) return [];
    return data;
  };

  const fetchBillWithPayments = async (
    billId: string
  ): Promise<BnplBillWithPayments | null> => {
    const supabase = createClient();
    const { data: bill, error: billError } = await supabase
      .from("bnpl_bills")
      .select("*")
      .eq("id", billId)
      .single();
    if (billError || !bill) return null;

    const { data: payments, error: payError } = await supabase
      .from("bnpl_payments")
      .select(
        `
        id,
        purchase_id,
        emi_number,
        amount,
        status,
        paid_date,
        bnpl_purchases!inner (
          item_name,
          total_emis
        )
      `
      )
      .eq("bill_id", billId)
      .order("emi_number", { ascending: true });

    if (payError || !payments) return { ...bill, payments: [] };

    const mappedPayments: BnplBillPaymentItem[] = payments.map(
      (p: Record<string, unknown>) => {
        const purchase = p.bnpl_purchases as Record<string, unknown>;
        return {
          payment_id: p.id as string,
          purchase_id: p.purchase_id as string,
          item_name: purchase.item_name as string,
          emi_number: p.emi_number as number,
          total_emis: purchase.total_emis as number,
          amount: p.amount as number,
          status: p.status as BnplBillPaymentItem["status"],
          paid_date: p.paid_date as string | null,
        };
      }
    );

    return { ...bill, payments: mappedPayments };
  };

  const payBill = async (
    billId: string,
    paidDate: string,
    paymentMethod: string = "upi",
    notes?: string
  ) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated"), data: null };

    const { data, error } = await supabase.rpc("pay_bnpl_bill", {
      p_bill_id: billId,
      p_user_id: user.id,
      p_paid_date: paidDate,
      p_payment_method: paymentMethod,
      p_notes: notes || null,
    });

    if (!error) {
      await fetchAll();
      incrementSync();
    }
    return { error, data };
  };

  // ── Derived data ──

  const activePurchases = useMemo(
    () => purchases.filter((p) => p.status === "active" || p.status === "overdue"),
    [purchases]
  );

  const totalBnplOutstanding = useMemo(
    () => activePurchases.reduce((sum, p) => sum + p.outstanding_balance, 0),
    [activePurchases]
  );

  const totalBnplMonthlyEMI = useMemo(
    () => activePurchases.reduce((sum, p) => sum + p.emi_amount, 0),
    [activePurchases]
  );

  const activePurchasesCount = activePurchases.length;

  const paidOffPurchases = useMemo(
    () =>
      purchases.filter(
        (p) => p.status === "paid_off" || p.status === "foreclosed"
      ).length,
    [purchases]
  );

  // Group purchases by platform for rendering
  const platformsWithPurchases = useMemo(() => {
    return platforms.map((platform) => ({
      ...platform,
      purchases: purchases.filter((p) => p.platform_id === platform.id),
    }));
  }, [platforms, purchases]);

  return {
    platforms,
    purchases,
    loading,
    fetchAll,
    fetchPlatforms,
    fetchPurchases,
    fetchPayments,
    fetchUpcomingEMIs,
    addPlatform,
    updatePlatform,
    deletePlatform,
    addPurchase,
    deletePurchase,
    payEMI,
    foreclosePurchase,
    fetchBills,
    fetchBillWithPayments,
    payBill,
    activePurchases,
    totalBnplOutstanding,
    totalBnplMonthlyEMI,
    activePurchasesCount,
    paidOffPurchases,
    platformsWithPurchases,
  };
}
