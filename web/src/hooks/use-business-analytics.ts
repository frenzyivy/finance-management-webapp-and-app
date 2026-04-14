"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import { useSyncStore } from "@/lib/stores/sync-store";
import { BUSINESS_EXPENSE_CATEGORIES } from "@/lib/constants/business-categories";
import type {
  BusinessIncome,
  BusinessExpense,
  BusinessSubscription,
  BusinessClient,
} from "@/types/business";

export interface PnLMonth {
  month: string;        // "Oct 2025"
  monthKey: string;     // "2025-10"
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  amount: number;
  percentage: number;
}

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  revenue: number;
  attributedExpenses: number;
  profit: number;
  margin: number;
}

export interface SubscriptionTrendPoint {
  month: string;
  monthKey: string;
  plannedBurn: number;  // monthly_equivalent sum
  actualSpend: number;  // actual expenses linked to subscriptions
}

function toKey(d: Date): string {
  return format(d, "yyyy-MM");
}

function toLabel(d: Date): string {
  return format(d, "MMM yyyy");
}

export function useBusinessAnalytics() {
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<BusinessIncome[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [subscriptions, setSubscriptions] = useState<BusinessSubscription[]>([]);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch last 6 months of income/expenses + all subs + all clients
    const now = new Date();
    const sixMonthsAgo = startOfMonth(subMonths(now, 5))
      .toISOString()
      .split("T")[0];

    const [incomeRes, expenseRes, subsRes, clientsRes] = await Promise.all([
      supabase
        .from("business_income")
        .select("*")
        .gte("date", sixMonthsAgo)
        .order("date", { ascending: true }),
      supabase
        .from("business_expenses")
        .select("*")
        .gte("date", sixMonthsAgo)
        .order("date", { ascending: true }),
      supabase.from("business_subscriptions").select("*"),
      supabase.from("business_clients").select("*"),
    ]);

    if (!incomeRes.error && incomeRes.data) setIncome(incomeRes.data);
    if (!expenseRes.error && expenseRes.data) setExpenses(expenseRes.data);
    if (!subsRes.error && subsRes.data) setSubscriptions(subsRes.data);
    if (!clientsRes.error && clientsRes.data) setClients(clientsRes.data);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  // ── 6-month P&L ────────────────────────────────────────────────
  const pnl = useMemo<PnLMonth[]>(() => {
    const now = new Date();
    const months: PnLMonth[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d).toISOString().split("T")[0];
      const end = endOfMonth(d).toISOString().split("T")[0];
      const monthKey = toKey(d);
      const revenue = income
        .filter((r) => r.date >= start && r.date <= end)
        .reduce((s, r) => s + Number(r.amount), 0);
      const exps = expenses
        .filter((e) => e.date >= start && e.date <= end)
        .reduce((s, e) => s + Number(e.amount), 0);
      months.push({
        month: toLabel(d),
        monthKey,
        revenue,
        expenses: exps,
        profit: revenue - exps,
      });
    }
    return months;
  }, [income, expenses]);

  // ── Current month expense breakdown (pie) ──────────────────────
  const expenseBreakdown = useMemo<CategoryBreakdown[]>(() => {
    const now = new Date();
    const start = startOfMonth(now).toISOString().split("T")[0];
    const end = endOfMonth(now).toISOString().split("T")[0];
    const thisMonth = expenses.filter((e) => e.date >= start && e.date <= end);
    const total = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
    if (total === 0) return [];

    const byCategory = new Map<string, number>();
    for (const e of thisMonth) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
    }
    return Array.from(byCategory.entries())
      .map(([cat, amt]) => ({
        category: cat,
        label: BUSINESS_EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat,
        amount: amt,
        percentage: (amt / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // ── Client profitability (last 6mo) ────────────────────────────
  const clientProfitability = useMemo<ClientRevenue[]>(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const rows = new Map<string, { revenue: number; expenses: number }>();

    // Seed with any clients that have a record
    for (const r of income) {
      if (!r.client_id) continue;
      const cur = rows.get(r.client_id) ?? { revenue: 0, expenses: 0 };
      cur.revenue += Number(r.amount);
      rows.set(r.client_id, cur);
    }
    for (const e of expenses) {
      if (!e.client_id) continue;
      const cur = rows.get(e.client_id) ?? { revenue: 0, expenses: 0 };
      cur.expenses += Number(e.amount);
      rows.set(e.client_id, cur);
    }

    return Array.from(rows.entries())
      .map(([clientId, v]) => {
        const profit = v.revenue - v.expenses;
        const margin = v.revenue > 0 ? (profit / v.revenue) * 100 : 0;
        return {
          clientId,
          clientName: clientMap.get(clientId) ?? "(deleted client)",
          revenue: v.revenue,
          attributedExpenses: v.expenses,
          profit,
          margin,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [income, expenses, clients]);

  // ── Subscription cost trend (planned vs actual over 6 months) ──
  const subscriptionTrend = useMemo<SubscriptionTrendPoint[]>(() => {
    const now = new Date();
    const months: SubscriptionTrendPoint[] = [];

    // Planned burn is the current sum — we show it as a flat line since we
    // don't store historical subscription state. Actual spend varies by month.
    const activeMonthlyBurn = subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + Number(s.monthly_equivalent ?? 0), 0);

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d).toISOString().split("T")[0];
      const end = endOfMonth(d).toISOString().split("T")[0];
      const actualSpend = expenses
        .filter((e) => e.subscription_id && e.date >= start && e.date <= end)
        .reduce((s, e) => s + Number(e.amount), 0);
      months.push({
        month: toLabel(d),
        monthKey: toKey(d),
        plannedBurn: activeMonthlyBurn,
        actualSpend,
      });
    }
    return months;
  }, [subscriptions, expenses]);

  // ── Essential vs nice-to-have split ────────────────────────────
  const subscriptionSplit = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active");
    const essential = active.filter((s) => s.is_essential);
    const niceToHave = active.filter((s) => !s.is_essential);
    return {
      essentialCount: essential.length,
      essentialBurn: essential.reduce((s, x) => s + Number(x.monthly_equivalent ?? 0), 0),
      niceToHaveCount: niceToHave.length,
      niceToHaveBurn: niceToHave.reduce((s, x) => s + Number(x.monthly_equivalent ?? 0), 0),
      niceToHave,
    };
  }, [subscriptions]);

  return {
    loading,
    pnl,
    expenseBreakdown,
    clientProfitability,
    subscriptionTrend,
    subscriptionSplit,
    subscriptions,
    fetchData,
  };
}