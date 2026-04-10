import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatDate } from "../lib/format";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../lib/constants";
import type { ExpenseEntry } from "../types/database";

function getCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getPaymentMethodLabel(value: string | null): string {
  if (!value) return "";
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

const CATEGORY_COLORS: Record<string, string> = {
  credit_card_payments: "#7c3aed",
  emis: "#db2777",
  rent: "#ea580c",
  food_groceries: "#16a34a",
  utilities: "#2563eb",
  transport: "#0891b2",
  shopping: "#d97706",
  health: "#dc2626",
  education: "#4f46e5",
  entertainment: "#c026d3",
  subscriptions: "#0d9488",
  family_personal: "#be185d",
  miscellaneous: "#6b7280",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#6b7280";
}

export function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase
        .from("expense_entries")
        .select("*")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;

      const items: ExpenseEntry[] = data ?? [];
      setEntries(items);
      setTotalThisMonth(items.reduce((s, e) => s + e.amount, 0));
    } catch (err) {
      console.error("Expenses fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(
    (entry: ExpenseEntry) => {
      Alert.alert(
        "Delete Expense",
        `Are you sure you want to delete this expense of ${formatCurrency(entry.amount)}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("expense_entries")
                  .delete()
                  .eq("id", entry.id);
                if (error) throw error;
                fetchData();
              } catch (err: any) {
                Alert.alert("Error", err.message ?? "Failed to delete entry");
              }
            },
          },
        ]
      );
    },
    [fetchData]
  );

  const renderItem = ({ item }: { item: ExpenseEntry }) => {
    const catColor = getCategoryColor(item.category);
    return (
      <TouchableOpacity
        style={styles.entryRow}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.entryLeft}>
          <Text style={styles.entryDescription} numberOfLines={1}>
            {item.description ?? getCategoryLabel(item.category)}
          </Text>
          <View style={styles.entryMeta}>
            <View style={[styles.badge, { backgroundColor: catColor + "20" }]}>
              <Text style={[styles.badgeText, { color: catColor }]}>
                {getCategoryLabel(item.category)}
              </Text>
            </View>
            {item.payment_method && (
              <Text style={styles.paymentMethod}>
                {getPaymentMethodLabel(item.payment_method)}
              </Text>
            )}
          </View>
          <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
        </View>
        <Text style={styles.entryAmount}>-{formatCurrency(item.amount)}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>Total This Month</Text>
        <Text style={styles.summaryAmount}>
          {formatCurrency(totalThisMonth)}
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0d9488"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No expenses this month.</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first expense.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddExpense")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  summaryBar: {
    backgroundColor: "#f87171",
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  entryLeft: {
    flex: 1,
    marginRight: 8,
  },
  entryDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
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
  paymentMethod: {
    fontSize: 11,
    color: "#6b7280",
  },
  entryDate: {
    fontSize: 12,
    color: "#6b7280",
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f87171",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    color: "#9ca3af",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "300",
    marginTop: -2,
  },
});
