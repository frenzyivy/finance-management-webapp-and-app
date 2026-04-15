import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { SavingsGoal } from "../types/database";
import { formatDate } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";

const PRIORITY_TONE: Record<string, "danger" | "warn" | "ok"> = {
  high: "danger",
  medium: "warn",
  low: "ok",
};

const GOAL_PALETTE = ["#0D9373", "#F5A623", "#42A5F5", "#AB47BC", "#E8453C", "#F5A623"];

function getGoalColor(index: number): string {
  return GOAL_PALETTE[index % GOAL_PALETTE.length];
}

export function GoalsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const priorityBg = (tone: "danger" | "warn" | "ok") =>
    tone === "danger"
      ? colors.expenseLight
      : tone === "warn"
      ? "rgba(245,166,35,0.18)"
      : colors.incomeLight;

  const priorityFg = (tone: "danger" | "warn" | "ok") =>
    tone === "danger" ? colors.expense : tone === "warn" ? colors.warning : colors.income;

  const renderGoal = ({ item, index }: { item: SavingsGoal; index: number }) => {
    const progress = item.target_amount > 0
      ? Math.min((item.current_balance / item.target_amount) * 100, 100)
      : 0;
    const color = getGoalColor(index);
    const tone = PRIORITY_TONE[item.priority] ?? "ok";

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[typography.sectionTitle, { color: colors.textPrimary, flex: 1, marginRight: 8 }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View style={styles.badgeRow}>
            {item.status !== "active" && (
              <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[typography.pillLabel, { color: colors.textSecondary }]}>
                  {item.status}
                </Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: priorityBg(tone) }]}>
              <Text style={[typography.pillLabel, { color: priorityFg(tone) }]}>
                {item.priority}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progress}%`, backgroundColor: color },
            ]}
          />
        </View>

        <Text style={[typography.caption, { color: colors.textPrimary, marginBottom: 4 }]}>
          {formatINR(item.current_balance)} / {formatINR(item.target_amount)} ({Math.round(progress)}%)
        </Text>

        {item.target_date && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 10 }]}>
            Target: {formatDate(item.target_date)}
          </Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.accent,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPress={() => handleAddMoney(item)}
          >
            <Text style={[typography.caption, { color: "#fff" }]}>Add Money</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPress={() => navigation.navigate("AddGoal", { goal: item })}
          >
            <Text style={[typography.caption, { color: colors.textPrimary }]}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.expenseLight,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            onPress={() => handleDelete(item)}
          >
            <Text style={[typography.caption, { color: colors.expense }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: navHeight + 40 + insets.bottom,
        }}
        ListHeaderComponent={
          <>
            <PageHeader
              title="Savings Goals"
              actions={
                <Pressable
                  onPress={() => navigation.navigate("AddGoal")}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textPrimary}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  >
                    <Path d="M12 5v14M5 12h14" />
                  </Svg>
                </Pressable>
              }
            />

            <View
              style={[
                styles.summary,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[typography.pillLabel, { color: colors.textSecondary }]}>
                Total Saved
              </Text>
              <Text
                style={[
                  typography.heroAmount,
                  { color: colors.textPrimary, marginTop: 6 },
                ]}
              >
                {formatINR(totalSaved)}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎯</Text>
            <Text style={[typography.sectionTitle, { color: colors.textPrimary }]}>
              No Goals Yet
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 4 },
              ]}
            >
              Start saving towards your dreams!
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      />

      <Modal visible={addMoneyModalVisible} transparent animationType="fade">
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
              Add Money to {selectedGoal?.name}
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
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={contributionAmount}
              onChangeText={setContributionAmount}
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
                onPress={() => setAddMoneyModalVisible(false)}
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
                onPress={confirmAddMoney}
              >
                <Text style={[typography.body, { color: "#fff" }]}>Add</Text>
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badgeRow: { flexDirection: "row", gap: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  empty: { alignItems: "center", paddingTop: 60 },
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
