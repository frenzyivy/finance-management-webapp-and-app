import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES } from "../lib/constants";
import { formatCurrency } from "../lib/format";
import type { BudgetLimit, ExpenseCategory } from "../types/database";

interface CategoryBudget {
  category: ExpenseCategory;
  label: string;
  spent: number;
  limit: number;
  budgetId: string | null;
}

export function BudgetScreen() {
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<CategoryBudget[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBudget | null>(null);
  const [limitInput, setLimitInput] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split("T")[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split("T")[0];

      const [budgetRes, expenseRes] = await Promise.all([
        supabase
          .from("budget_limits")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("expense_entries")
          .select("*")
          .gte("date", monthStart)
          .lte("date", monthEnd),
      ]);

      const budgets: BudgetLimit[] = budgetRes.data ?? [];
      const expenses = expenseRes.data ?? [];

      // Compute spending per category
      const spentMap: Record<string, number> = {};
      for (const e of expenses) {
        spentMap[e.category] = (spentMap[e.category] ?? 0) + e.amount;
      }

      // Build budget map
      const budgetMap: Record<string, BudgetLimit> = {};
      for (const b of budgets) {
        budgetMap[b.category] = b;
      }

      const result: CategoryBudget[] = EXPENSE_CATEGORIES.map((cat) => ({
        category: cat.value as ExpenseCategory,
        label: cat.label,
        spent: spentMap[cat.value] ?? 0,
        limit: budgetMap[cat.value]?.monthly_limit ?? 0,
        budgetId: budgetMap[cat.value]?.id ?? null,
      }));

      setCategories(result);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load budgets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  const openSetLimit = (cat: CategoryBudget) => {
    setSelectedCategory(cat);
    setLimitInput(cat.limit > 0 ? String(cat.limit) : "");
    setModalVisible(true);
  };

  const handleSaveLimit = async () => {
    if (!selectedCategory) return;
    const amount = parseFloat(limitInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (amount === 0 && selectedCategory.budgetId) {
        // Remove limit
        await supabase.from("budget_limits").delete().eq("id", selectedCategory.budgetId);
      } else if (selectedCategory.budgetId) {
        // Update existing
        await supabase
          .from("budget_limits")
          .update({ monthly_limit: amount })
          .eq("id", selectedCategory.budgetId);
      } else if (amount > 0) {
        // Insert new
        await supabase.from("budget_limits").insert({
          user_id: user.id,
          category: selectedCategory.category,
          monthly_limit: amount,
          month: new Date().toISOString().split("T")[0].slice(0, 7),
        });
      }

      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save limit");
    }
  };

  const clearAllLimits = () => {
    Alert.alert("Clear All Limits", "Remove all budget limits?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from("budget_limits").delete().eq("user_id", user.id);
            fetchData();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to clear limits");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  const categoriesWithLimits = categories.filter((c) => c.limit > 0);
  const categoriesWithoutLimits = categories.filter((c) => c.limit === 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={["#0d9488"]} />
        }
      >
        {/* Categories with limits */}
        {categoriesWithLimits.length > 0 && (
          <>
            <Text style={styles.groupTitle}>Active Budgets</Text>
            {categoriesWithLimits.map((cat) => {
              const pct = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
              const barColor = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#22c55e";

              return (
                <TouchableOpacity
                  key={cat.category}
                  style={styles.row}
                  onPress={() => openSetLimit(cat)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowHeader}>
                    <Text style={styles.catLabel}>{cat.label}</Text>
                    <Text style={[styles.pctText, { color: barColor }]}>
                      {Math.round(pct)}%
                    </Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.amountText}>
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.limit)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Categories without limits */}
        <Text style={styles.groupTitle}>Set Budget For</Text>
        {categoriesWithoutLimits.map((cat) => (
          <TouchableOpacity
            key={cat.category}
            style={styles.row}
            onPress={() => openSetLimit(cat)}
            activeOpacity={0.7}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <Text style={styles.setLimitText}>Set Limit</Text>
            </View>
            {cat.spent > 0 && (
              <Text style={styles.spentOnlyText}>
                Spent: {formatCurrency(cat.spent)}
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Clear All */}
        {categoriesWithLimits.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAllLimits}>
            <Text style={styles.clearBtnText}>Clear All Limits</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Set Limit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedCategory?.label ?? ""} - Monthly Limit
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter monthly limit (0 to remove)"
              keyboardType="numeric"
              value={limitInput}
              onChangeText={setLimitInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#6b7280" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#0d9488" }]}
                onPress={handleSaveLimit}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40 },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catLabel: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  pctText: { fontSize: 14, fontWeight: "700" },
  setLimitText: { fontSize: 13, color: "#0d9488", fontWeight: "600" },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    marginBottom: 4,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  amountText: { fontSize: 12, color: "#6b7280" },
  spentOnlyText: { fontSize: 12, color: "#6b7280" },
  clearBtn: {
    alignItems: "center",
    marginTop: 24,
    padding: 14,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
  },
  clearBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  modalBtnText: { color: "#fff", fontWeight: "600" },
});
