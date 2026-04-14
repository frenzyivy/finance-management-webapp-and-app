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
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../lib/constants";
import { BudgetAlert } from "../components/BudgetAlert";
import type { IncomeEntry, ExpenseEntry, SavingsGoal } from "../types/database";

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
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.value === value)?.label ?? value;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
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

      const [incomeRes, expenseRes, goalsRes] = await Promise.all([
        supabase
          .from("income_entries")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("expense_entries")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("savings_goals")
          .select("*")
          .eq("status", "active"),
      ]);

      const incomeData: IncomeEntry[] = incomeRes.data ?? [];
      const expenseData: ExpenseEntry[] = expenseRes.data ?? [];
      const goalsData: SavingsGoal[] = goalsRes.data ?? [];

      const incomeTotal = incomeData.reduce((s, i) => s + i.amount, 0);
      const expenseTotal = expenseData.reduce((s, e) => s + e.amount, 0);
      const savingsTotal = goalsData.reduce((s, g) => s + g.current_balance, 0);

      setTotalIncome(incomeTotal);
      setTotalExpenses(expenseTotal);
      setTotalSavings(savingsTotal);

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
          description: e.payee_name ?? "Expense",
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
      console.error("Dashboard fetch error:", err);
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
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  const netCashFlow = totalIncome - totalExpenses;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0d9488"
        />
      }
    >
      {/* Summary Cards */}
      <View style={styles.cardGrid}>
        <View style={[styles.card, { borderLeftColor: "#22c55e" }]}>
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardTitle}>Total Income</Text>
          <Text style={[styles.cardAmount, { color: "#22c55e" }]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={[styles.card, { borderLeftColor: "#f87171" }]}>
          <Text style={styles.cardIcon}>💸</Text>
          <Text style={styles.cardTitle}>Total Expenses</Text>
          <Text style={[styles.cardAmount, { color: "#f87171" }]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        <View
          style={[
            styles.card,
            { borderLeftColor: netCashFlow >= 0 ? "#0d9488" : "#f87171" },
          ]}
        >
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Net Cash Flow</Text>
          <Text
            style={[
              styles.cardAmount,
              { color: netCashFlow >= 0 ? "#0d9488" : "#f87171" },
            ]}
          >
            {formatCurrency(netCashFlow)}
          </Text>
        </View>
        <View style={[styles.card, { borderLeftColor: "#f59e0b" }]}>
          <Text style={styles.cardIcon}>🐷</Text>
          <Text style={styles.cardTitle}>Savings</Text>
          <Text style={[styles.cardAmount, { color: "#f59e0b" }]}>
            {formatCurrency(totalSavings)}
          </Text>
        </View>
      </View>

      {/* Budget Alerts */}
      <BudgetAlert />

      {/* Import Transactions Card */}
      <TouchableOpacity
        style={styles.importCard}
        onPress={() => navigation.navigate("Imports")}
        activeOpacity={0.7}
      >
        <Text style={styles.importIcon}>📥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.importTitle}>Import Transactions</Text>
          <Text style={styles.importDesc}>
            Scan SMS or upload bank statements
          </Text>
        </View>
        <Text style={styles.importArrow}>→</Text>
      </TouchableOpacity>

      {/* Recent Transactions */}
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No transactions this month yet.
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
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
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
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 4,
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
  importCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  importIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  importTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0d9488",
  },
  importDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  importArrow: {
    fontSize: 18,
    color: "#0d9488",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
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
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
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
