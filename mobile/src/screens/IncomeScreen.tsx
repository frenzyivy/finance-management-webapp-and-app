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
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "../lib/constants";
import type { IncomeEntry } from "../types/database";

function getCategoryLabel(value: string): string {
  return INCOME_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getPaymentMethodLabel(value: string | null): string {
  if (!value) return "";
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function IncomeScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
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
        .from("income_entries")
        .select("*")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;

      const items: IncomeEntry[] = data ?? [];
      setEntries(items);
      setTotalThisMonth(items.reduce((s, i) => s + i.amount, 0));
    } catch (err) {
      console.error("Income fetch error:", err);
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
    (entry: IncomeEntry) => {
      Alert.alert(
        "Delete Income",
        `Are you sure you want to delete "${entry.source}" (${formatCurrency(entry.amount)})?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("income_entries")
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

  const renderItem = ({ item }: { item: IncomeEntry }) => (
    <TouchableOpacity
      style={styles.entryRow}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      <View style={styles.entryLeft}>
        <Text style={styles.entrySource} numberOfLines={1}>
          {item.source}
        </Text>
        <View style={styles.entryMeta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
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
      <Text style={styles.entryAmount}>+{formatCurrency(item.amount)}</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.emptyText}>No income entries this month.</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first entry.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddIncome")}
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
    backgroundColor: "#0d9488",
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
  entrySource: {
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
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
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
    color: "#22c55e",
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
