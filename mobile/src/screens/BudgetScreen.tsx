import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES } from "../lib/constants";
import type { BudgetLimit, ExpenseCategory } from "../types/database";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";

interface CategoryBudget {
  category: ExpenseCategory;
  label: string;
  spent: number;
  limit: number;
  budgetId: string | null;
}

export function BudgetScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

      const spentMap: Record<string, number> = {};
      for (const e of expenses) {
        spentMap[e.category] = (spentMap[e.category] ?? 0) + e.amount;
      }

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
        await supabase.from("budget_limits").delete().eq("id", selectedCategory.budgetId);
      } else if (selectedCategory.budgetId) {
        await supabase
          .from("budget_limits")
          .update({ monthly_limit: amount })
          .eq("id", selectedCategory.budgetId);
      } else if (amount > 0) {
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
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const categoriesWithLimits = categories.filter((c) => c.limit > 0);
  const categoriesWithoutLimits = categories.filter((c) => c.limit === 0);

  const barColorFor = (pct: number) =>
    pct >= 100 ? colors.expense : pct >= 80 ? colors.warning : colors.income;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <PageHeader title="Budget" />

        <View style={{ paddingHorizontal: 24 }}>
          {/* Categories with limits */}
          {categoriesWithLimits.length > 0 && (
            <>
              <Text
                style={[
                  typography.sectionTitle,
                  { color: colors.textPrimary, marginTop: 4, marginBottom: 12 },
                ]}
              >
                Active Budgets
              </Text>
              {categoriesWithLimits.map((cat) => {
                const pct = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
                const barColor = barColorFor(pct);

                return (
                  <Pressable
                    key={cat.category}
                    onPress={() => openSetLimit(cat)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.rowHeader}>
                      <Text style={[typography.body, { color: colors.textPrimary }]}>
                        {cat.label}
                      </Text>
                      <Text style={[typography.body, { color: barColor }]}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: colors.surfaceAlt }]}>
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
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {formatINR(cat.spent)} / {formatINR(cat.limit)}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}

          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginTop: 20, marginBottom: 12 },
            ]}
          >
            Set Budget For
          </Text>
          {categoriesWithoutLimits.map((cat) => (
            <Pressable
              key={cat.category}
              onPress={() => openSetLimit(cat)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {cat.label}
                </Text>
                <Text style={[typography.caption, { color: colors.accent }]}>Set Limit</Text>
              </View>
              {cat.spent > 0 && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Spent: {formatINR(cat.spent)}
                </Text>
              )}
            </Pressable>
          ))}

          {categoriesWithLimits.length > 0 && (
            <Pressable
              onPress={clearAllLimits}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  backgroundColor: colors.expenseLight,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={[typography.body, { color: colors.expense }]}>
                Clear All Limits
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Set Limit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.sectionTitle,
                { color: colors.textPrimary, marginBottom: 16 },
              ]}
            >
              {selectedCategory?.label ?? ""} - Monthly Limit
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}
              placeholder="Enter monthly limit (0 to remove)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={limitInput}
              onChangeText={setLimitInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.accent,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                onPress={handleSaveLimit}
              >
                <Text style={[typography.body, { color: "#fff" }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  clearBtn: {
    alignItems: "center",
    marginTop: 24,
    padding: 14,
    borderRadius: radii.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    width: "85%",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100 },
});
