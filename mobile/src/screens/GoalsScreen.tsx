import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { SavingsGoal } from "../types/database";
import { formatCurrency, formatDate } from "../lib/format";

const PRIORITY_COLORS: Record<string, string> = {
  high: "#f87171",
  medium: "#f59e0b",
  low: "#22c55e",
};

const GOAL_COLORS = ["#0d9488", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"];

function getGoalColor(index: number): string {
  return GOAL_COLORS[index % GOAL_COLORS.length];
}

export function GoalsScreen({ navigation }: any) {
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");

  const fetchGoals = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load goals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    const unsubscribe = navigation.addListener("focus", fetchGoals);
    return unsubscribe;
  }, [fetchGoals, navigation, syncVersion]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("AddGoal")}
          style={{ marginRight: 16 }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>+ New</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGoals();
  };

  const totalSaved = goals.reduce((sum, g) => sum + g.current_balance, 0);

  const handleAddMoney = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setContributionAmount("");
    setAddMoneyModalVisible(true);
  };

  const confirmAddMoney = async () => {
    if (!selectedGoal) return;
    const amount = parseFloat(contributionAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: contribError } = await supabase
        .from("savings_contributions")
        .insert({
          goal_id: selectedGoal.id,
          user_id: user.id,
          amount,
          date: new Date().toISOString().split("T")[0],
        });

      if (contribError) throw contribError;

      const newBalance = selectedGoal.current_balance + amount;
      const updates: any = { current_balance: newBalance, updated_at: new Date().toISOString() };
      if (newBalance >= selectedGoal.target_amount) {
        updates.status = "completed";
      }

      const { error: updateError } = await supabase
        .from("savings_goals")
        .update(updates)
        .eq("id", selectedGoal.id);

      if (updateError) throw updateError;

      setAddMoneyModalVisible(false);
      fetchGoals();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add contribution");
    }
  };

  const handleDelete = (goal: SavingsGoal) => {
    Alert.alert("Delete Goal", `Delete "${goal.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.from("savings_contributions").delete().eq("goal_id", goal.id);
            const { error } = await supabase.from("savings_goals").delete().eq("id", goal.id);
            if (error) throw error;
            fetchGoals();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete goal");
          }
        },
      },
    ]);
  };

  const renderGoal = ({ item, index }: { item: SavingsGoal; index: number }) => {
    const progress = item.target_amount > 0
      ? Math.min((item.current_balance / item.target_amount) * 100, 100)
      : 0;
    const color = getGoalColor(index);

    return (
      <View style={styles.card}>
        <View style={[styles.colorBar, { backgroundColor: color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.goalName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.badgeRow}>
              {item.status !== "active" && (
                <View style={[styles.badge, { backgroundColor: "#6b7280" }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[item.priority] || "#6b7280" }]}>
                <Text style={styles.badgeText}>{item.priority}</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: color }]} />
          </View>

          <Text style={styles.progressText}>
            {formatCurrency(item.current_balance)} / {formatCurrency(item.target_amount)} ({Math.round(progress)}%)
          </Text>

          {item.target_date && (
            <Text style={styles.dateText}>Target: {formatDate(item.target_date)}</Text>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: color }]}
              onPress={() => handleAddMoney(item)}
            >
              <Text style={styles.actionBtnText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
              onPress={() => navigation.navigate("AddGoal", { goal: item })}
            >
              <Text style={styles.actionBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#f87171" }]}
              onPress={() => handleDelete(item)}
            >
              <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total Saved</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(totalSaved)}</Text>
      </View>

      {/* Goals List */}
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        contentContainerStyle={goals.length === 0 ? styles.centered : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No Goals Yet</Text>
            <Text style={styles.emptySubtitle}>Start saving towards your dreams!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0d9488"]} />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddGoal")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Money Modal */}
      <Modal visible={addMoneyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Money to {selectedGoal?.name}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              keyboardType="numeric"
              value={contributionAmount}
              onChangeText={setContributionAmount}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#6b7280" }]}
                onPress={() => setAddMoneyModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#0d9488" }]}
                onPress={confirmAddMoney}
              >
                <Text style={styles.modalBtnText}>Add</Text>
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
  summary: {
    backgroundColor: "#0d9488",
    padding: 20,
    alignItems: "center",
  },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  summaryAmount: { color: "#fff", fontSize: 28, fontWeight: "bold", marginTop: 4 },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: "row",
    overflow: "hidden",
  },
  colorBar: { width: 6 },
  cardContent: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  goalName: { fontSize: 16, fontWeight: "bold", color: "#1f2937", flex: 1, marginRight: 8 },
  badgeRow: { flexDirection: "row", gap: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: { fontSize: 13, color: "#1f2937", marginBottom: 4 },
  dateText: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  emptySubtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
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
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1f2937", marginBottom: 16 },
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
