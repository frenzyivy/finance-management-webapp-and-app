import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { formatCurrency, formatDate } from "../lib/format";
import {
  BUSINESS_INCOME_CATEGORIES,
  BUSINESS_EXPENSE_CATEGORIES,
} from "../lib/business-constants";
import type {
  BusinessIncome,
  BusinessExpense,
  BusinessSubscription,
} from "../types/business";

type Transaction = {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
};

function getCategoryLabel(
  value: string,
  type: "income" | "expense"
): string {
  const list =
    type === "income"
      ? BUSINESS_INCOME_CATEGORIES
      : BUSINESS_EXPENSE_CATEGORIES;
  return list.find((c) => c.value === value)?.label ?? value;
}

export function BusinessDashboardScreen() {
  const navigation = useNavigation<any>();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [subscriptionBurn, setSubscriptionBurn] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const [incomeRes, expenseRes, subsRes] = await Promise.all([
        supabase
          .from("business_income")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("business_expenses")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("business_subscriptions")
          .select("*")
          .eq("status", "active"),
      ]);

      const incomeData: BusinessIncome[] = incomeRes.data ?? [];
      const expenseData: BusinessExpense[] = expenseRes.data ?? [];
      const subsData: BusinessSubscription[] = subsRes.data ?? [];

      const revenueTotal = incomeData.reduce((s, i) => s + i.amount, 0);
      const expenseTotal = expenseData.reduce((s, e) => s + e.amount, 0);
      const burnTotal = subsData.reduce(
        (s, sub) => s + sub.monthly_equivalent,
        0
      );

      setTotalRevenue(revenueTotal);
      setTotalExpenses(expenseTotal);
      setSubscriptionBurn(burnTotal);

      const merged: Transaction[] = [
        ...incomeData.map((i) => ({
          id: i.id,
          type: "income" as const,
          description: i.source_name,
          category: i.category,
          date: i.date,
          amount: i.amount,
        })),
        ...expenseData.map((e) => ({
          id: e.id,
          type: "expense" as const,
          description: e.vendor_name,
          category: e.category,
          date: e.date,
          amount: e.amount,
        })),
      ];
      merged.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(merged.slice(0, 10));
    } catch (err) {
      console.error("Business dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  const netProfit = totalRevenue - totalExpenses;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#185FA5"
        />
      }
    >
      {/* Summary Cards */}
      <View style={styles.cardGrid}>
        <View style={[styles.card, { borderLeftColor: "#22c55e" }]}>
          <Text style={styles.cardTitle}>Revenue</Text>
          <Text style={[styles.cardAmount, { color: "#22c55e" }]}>
            {formatCurrency(totalRevenue)}
          </Text>
        </View>
        <View style={[styles.card, { borderLeftColor: "#f87171" }]}>
          <Text style={styles.cardTitle}>Expenses</Text>
          <Text style={[styles.cardAmount, { color: "#f87171" }]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        <View
          style={[
            styles.card,
            { borderLeftColor: netProfit >= 0 ? "#10b981" : "#ef4444" },
          ]}
        >
          <Text style={styles.cardTitle}>Net Profit</Text>
          <Text
            style={[
              styles.cardAmount,
              { color: netProfit >= 0 ? "#10b981" : "#ef4444" },
            ]}
          >
            {formatCurrency(netProfit)}
          </Text>
        </View>
        <View style={[styles.card, { borderLeftColor: "#f59e0b" }]}>
          <Text style={styles.cardTitle}>Subscription Burn</Text>
          <Text style={[styles.cardAmount, { color: "#f59e0b" }]}>
            {formatCurrency(subscriptionBurn)}/mo
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate("AddBusinessIncome")}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>+</Text>
          <Text style={styles.quickActionLabel}>Add Income</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate("AddBusinessExpense")}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>+</Text>
          <Text style={styles.quickActionLabel}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate("BusinessSubscriptions")}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>S</Text>
          <Text style={styles.quickActionLabel}>Subscriptions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate("BusinessClients")}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>C</Text>
          <Text style={styles.quickActionLabel}>Clients</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate("Transfers")}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>⇄</Text>
          <Text style={styles.quickActionLabel}>Transfers</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <Text style={styles.sectionTitle}>Recent Business Transactions</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No business transactions this month yet.
          </Text>
        </View>
      ) : (
        transactions.map((txn) => (
          <View key={txn.id} style={styles.txnRow}>
            <View
              style={[
                styles.txnIndicator,
                {
                  backgroundColor:
                    txn.type === "income" ? "#dcfce7" : "#fee2e2",
                },
              ]}
            >
              <Text style={styles.txnIndicatorText}>
                {txn.type === "income" ? "+" : "-"}
              </Text>
            </View>
            <View style={styles.txnDetails}>
              <Text style={styles.txnDescription} numberOfLines={1}>
                {txn.description}
              </Text>
              <View style={styles.txnMeta}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        txn.type === "income" ? "#dcfce7" : "#fee2e2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          txn.type === "income" ? "#16a34a" : "#dc2626",
                      },
                    ]}
                  >
                    {getCategoryLabel(txn.category, txn.type)}
                  </Text>
                </View>
                <Text style={styles.txnDate}>{formatDate(txn.date)}</Text>
              </View>
            </View>
            <Text
              style={[
                styles.txnAmount,
                {
                  color: txn.type === "income" ? "#22c55e" : "#f87171",
                },
              ]}
            >
              {txn.type === "income" ? "+" : "-"}
              {formatCurrency(txn.amount)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickActionIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#185FA5",
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  txnIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txnIndicatorText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  txnDetails: {
    flex: 1,
    marginRight: 8,
  },
  txnDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  txnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  txnDate: {
    fontSize: 12,
    color: "#6b7280",
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
});
