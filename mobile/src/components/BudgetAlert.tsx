import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES } from "../lib/constants";

interface AlertItem {
  label: string;
  pct: number;
  level: "warning" | "danger";
}

export function BudgetAlert() {
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString().split("T")[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString().split("T")[0];

        const [budgetRes, expenseRes] = await Promise.all([
          supabase.from("budget_limits").select("*").eq("user_id", user.id),
          supabase
            .from("expense_entries")
            .select("category, amount")
            .gte("date", monthStart)
            .lte("date", monthEnd),
        ]);

        const budgets = budgetRes.data ?? [];
        const expenses = expenseRes.data ?? [];

        if (budgets.length === 0) return;

        const spentMap: Record<string, number> = {};
        for (const e of expenses) {
          spentMap[e.category] = (spentMap[e.category] ?? 0) + e.amount;
        }

        const result: AlertItem[] = [];
        for (const b of budgets) {
          const spent = spentMap[b.category] ?? 0;
          const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
          if (pct >= 100) {
            const label = EXPENSE_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category;
            result.push({ label, pct, level: "danger" });
          } else if (pct >= 80) {
            const label = EXPENSE_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category;
            result.push({ label, pct, level: "warning" });
          }
        }

        setAlerts(result.sort((a, b) => b.pct - a.pct));
      } catch {
        // Silently fail — this is a non-critical UI element
      }
    })();
  }, [syncVersion]);

  if (alerts.length === 0) return null;

  return (
    <View style={styles.container}>
      {alerts.map((a) => (
        <View
          key={a.label}
          style={[
            styles.alert,
            a.level === "danger" ? styles.danger : styles.warning,
          ]}
        >
          <Text style={styles.alertText}>
            {a.level === "danger" ? "🔴" : "🟡"} {a.label}: {Math.round(a.pct)}% of budget used
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  alert: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  warning: { backgroundColor: "#fefce8" },
  danger: { backgroundColor: "#fef2f2" },
  alertText: { fontSize: 12, fontWeight: "600", color: "#1f2937" },
});
