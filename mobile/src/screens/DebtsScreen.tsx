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
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { Debt, DebtType } from "../types/database";
import { formatDate } from "../lib/format";
import { EXPENSE_CATEGORIES } from "../lib/constants";
import { EMICalendar } from "../components/EMICalendar";
import { PaymentReminders } from "../components/PaymentReminders";
import { PickerModal } from "../components/PickerModal";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";

const TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card",
  personal_loan: "Personal Loan",
  bnpl: "BNPL",
  borrowed_from_person: "Borrowed",
  other: "Other",
};

export function DebtsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  // Debt allocation state
  const [allocationModalVisible, setAllocationModalVisible] = useState(false);
  const [allocationDebt, setAllocationDebt] = useState<Debt | null>(null);
  const [allocPurpose, setAllocPurpose] = useState("");
  const [allocAmount, setAllocAmount] = useState("");
  const [allocCategory, setAllocCategory] = useState("food_groceries");
  const [showAllocCategoryPicker, setShowAllocCategoryPicker] = useState(false);
  const [allocSaving, setAllocSaving] = useState(false);

  const fetchDebts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDebts(data || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load debts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
    const unsubscribe = navigation.addListener("focus", fetchDebts);
    return unsubscribe;
  }, [fetchDebts, navigation, syncVersion]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDebts();
  };

  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.outstanding_balance, 0);

  const handleLogPayment = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount("");
    setPaymentModalVisible(true);
  };

  const confirmPayment = async () => {
    if (!selectedDebt) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: payError } = await supabase
        .from("debt_payments")
        .insert({
          debt_id: selectedDebt.id,
          user_id: user.id,
          amount,
          date: new Date().toISOString().split("T")[0],
        });

      if (payError) throw payError;

      const newBalance = Math.max(0, selectedDebt.outstanding_balance - amount);
      const updates: any = {
        outstanding_balance: newBalance,
        updated_at: new Date().toISOString(),
      };
      if (newBalance <= 0) {
        updates.status = "paid_off";
      }

      const { error: updateError } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", selectedDebt.id);

      if (updateError) throw updateError;

      setPaymentModalVisible(false);
      fetchDebts();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log payment");
    }
  };

  const handleDelete = (debt: Debt) => {
    Alert.alert("Delete Debt", `Delete "${debt.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.from("debt_payments").delete().eq("debt_id", debt.id);
            const { error } = await supabase.from("debts").delete().eq("id", debt.id);
            if (error) throw error;
            fetchDebts();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete debt");
          }
        },
      },
    ]);
  };

  const handleAllocate = (debt: Debt) => {
    setAllocationDebt(debt);
    setAllocPurpose("");
    setAllocAmount("");
    setAllocCategory("food_groceries");
    setAllocationModalVisible(true);
  };

  const confirmAllocation = async () => {
    if (!allocationDebt) return;
    const amount = parseFloat(allocAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }
    if (!allocPurpose.trim()) {
      Alert.alert("Invalid", "Please enter a purpose");
      return;
    }

    const existingAllocated = (allocationDebt as any).allocated_amount ?? 0;
    const maxAllocatable = allocationDebt.original_amount - existingAllocated;
    if (amount > maxAllocatable) {
      Alert.alert("Invalid", `Amount exceeds available (${formatINR(maxAllocatable)})`);
      return;
    }

    setAllocSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allocPayload = [{
        amount,
        category: allocCategory,
        sub_category: null,
        payee_name: `${allocationDebt.creditor_name} (debt)`,
        date: new Date().toISOString().split("T")[0],
        description: allocPurpose.trim(),
        payment_method: "bank_transfer",
      }];

      const { error } = await supabase.rpc("create_debt_allocations", {
        p_debt_id: allocationDebt.id,
        p_user_id: user.id,
        p_allocations: allocPayload,
      });

      if (error) throw error;

      setAllocationModalVisible(false);
      fetchDebts();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save allocation");
    } finally {
      setAllocSaving(false);
    }
  };

  const renderDebt = ({ item }: { item: Debt }) => {
    const paid = item.original_amount - item.outstanding_balance;
    const progress = item.original_amount > 0
      ? Math.min((paid / item.original_amount) * 100, 100)
      : 0;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, flex: 1, marginRight: 8 },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={[typography.pillLabel, { color: colors.textSecondary }]}>
              {TYPE_LABELS[item.type] || item.type}
            </Text>
          </View>
        </View>

        {item.creditor_name && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>
            {item.creditor_name}
          </Text>
        )}

        <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progress}%`, backgroundColor: colors.income },
            ]}
          />
        </View>

        <Text style={[typography.caption, { color: colors.textPrimary, marginBottom: 2 }]}>
          Paid {formatINR(paid)} / {formatINR(item.original_amount)} ({Math.round(progress)}%)
        </Text>

        <Text style={[typography.amount, { color: colors.expense, marginBottom: 4 }]}>
          Outstanding: {formatINR(item.outstanding_balance)}
        </Text>

        {item.emi_amount != null && item.emi_amount > 0 && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
            {formatINR(item.emi_amount)}/month
            {item.expected_payoff_date ? ` | Payoff: ${formatDate(item.expected_payoff_date)}` : ""}
          </Text>
        )}

        {item.status === "paid_off" && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.incomeLight,
                alignSelf: "flex-start",
                marginTop: 4,
              },
            ]}
          >
            <Text style={[typography.pillLabel, { color: colors.income }]}>Paid Off</Text>
          </View>
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
            onPress={() => handleLogPayment(item)}
          >
            <Text style={[typography.caption, { color: "#fff" }]}>Log Payment</Text>
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
            onPress={() => handleAllocate(item)}
          >
            <Text style={[typography.caption, { color: colors.textPrimary }]}>Allocate</Text>
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
            onPress={() => navigation.navigate("AddDebt", { debt: item })}
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
        data={debts}
        keyExtractor={(item) => item.id}
        renderItem={renderDebt}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: navHeight + 40 + insets.bottom,
        }}
        ListHeaderComponent={
          <>
            <PageHeader
              title="Debts"
              actions={
                <>
                  <Pressable
                    onPress={() => navigation.navigate("ScanBnplInvoice")}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>✨</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate("CCStatementUpload", {
                        creditCardId: "",
                        cardName: "Credit Card",
                      })
                    }
                    style={({ pressed }) => [
                      styles.iconBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>📄</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate("AddDebt")}
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
                </>
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
              <View style={styles.summaryItem}>
                <Text style={[typography.pillLabel, { color: colors.textSecondary }]}>
                  Total Debt
                </Text>
                <Text
                  style={[
                    typography.heroAmount,
                    { color: colors.expense, marginTop: 6 },
                  ]}
                >
                  {formatINR(totalDebt)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[typography.pillLabel, { color: colors.textSecondary }]}>
                  Active
                </Text>
                <Text
                  style={[
                    typography.heroAmount,
                    { color: colors.textPrimary, marginTop: 6 },
                  ]}
                >
                  {activeDebts.length}
                </Text>
              </View>
            </View>

            {debts.length > 0 ? (
              <>
                <PaymentReminders
                  debts={debts}
                  onLogPayment={(debtId) => {
                    const debt = debts.find((d) => d.id === debtId);
                    if (debt) handleLogPayment(debt);
                  }}
                />
                <EMICalendar debts={debts} />
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💳</Text>
            <Text style={[typography.sectionTitle, { color: colors.textPrimary }]}>
              No Debts Tracked
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 4 },
              ]}
            >
              Start tracking to become debt-free!
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

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
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
              Log Payment for {selectedDebt?.name}
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
              placeholder="Payment Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
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
                onPress={() => setPaymentModalVisible(false)}
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
                onPress={confirmPayment}
              >
                <Text style={[typography.body, { color: "#fff" }]}>Log</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Allocation Modal */}
      <Modal visible={allocationModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxHeight: "80%",
              },
            ]}
          >
            <ScrollView>
              <Text
                style={[
                  typography.sectionTitle,
                  { color: colors.textPrimary, marginBottom: 16 },
                ]}
              >
                Allocate: {allocationDebt?.name}
              </Text>

              {allocationDebt && (
                <View
                  style={[
                    styles.allocSummary,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.textPrimary }]}>
                    {formatINR(allocationDebt.original_amount)} from {allocationDebt.creditor_name}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {formatINR(
                      allocationDebt.original_amount -
                        ((allocationDebt as any).allocated_amount ?? 0)
                    )}{" "}
                    available to allocate
                  </Text>
                </View>
              )}

              <Text
                style={[
                  typography.body,
                  { color: colors.textPrimary, marginBottom: 6 },
                ]}
              >
                Purpose *
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
                placeholder="e.g. Room deposit, Phone purchase"
                placeholderTextColor={colors.textSecondary}
                value={allocPurpose}
                onChangeText={setAllocPurpose}
              />

              <Text
                style={[
                  typography.body,
                  { color: colors.textPrimary, marginBottom: 6 },
                ]}
              >
                Amount *
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
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={allocAmount}
                onChangeText={setAllocAmount}
              />

              <Text
                style={[
                  typography.body,
                  { color: colors.textPrimary, marginBottom: 6 },
                ]}
              >
                Category
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.allocPickerBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                onPress={() => setShowAllocCategoryPicker(true)}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {EXPENSE_CATEGORIES.find((c) => c.value === allocCategory)?.label ?? allocCategory}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>▼</Text>
              </Pressable>

              <View style={[styles.modalActions, { marginTop: 16 }]}>
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
                  onPress={() => setAllocationModalVisible(false)}
                >
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    {
                      backgroundColor: colors.accent,
                      opacity: allocSaving ? 0.6 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  onPress={confirmAllocation}
                  disabled={allocSaving}
                >
                  {allocSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[typography.body, { color: "#fff" }]}>Save</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PickerModal
        visible={showAllocCategoryPicker}
        onClose={() => setShowAllocCategoryPicker(false)}
        options={EXPENSE_CATEGORIES.filter((c) => c.value !== "debt_repayment")}
        selectedValue={allocCategory}
        onSelect={(val) => setAllocCategory(val)}
        title="Select Category"
      />
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
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  summaryItem: { alignItems: "center" },
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
    marginBottom: 6,
  },
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
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
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
  allocSummary: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  allocPickerBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
});
