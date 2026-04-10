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
} from "react-native";
import { supabase } from "../lib/supabase";
import { Debt, DebtType } from "../types/database";
import { formatCurrency, formatDate } from "../lib/format";

const TYPE_COLORS: Record<DebtType, string> = {
  credit_card: "#f87171",
  personal_loan: "#3b82f6",
  bnpl: "#8b5cf6",
  borrowed_from_person: "#f59e0b",
  other: "#6b7280",
};

const TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card",
  personal_loan: "Personal Loan",
  bnpl: "BNPL",
  borrowed_from_person: "Borrowed",
  other: "Other",
};

export function DebtsScreen({ navigation }: any) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

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
  }, [fetchDebts, navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("AddDebt")}
          style={{ marginRight: 16 }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>+ New</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDebts();
  };

  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.current_balance, 0);

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

      const newBalance = Math.max(0, selectedDebt.current_balance - amount);
      const updates: any = {
        current_balance: newBalance,
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

  const renderDebt = ({ item }: { item: Debt }) => {
    const paid = item.principal_amount - item.current_balance;
    const progress = item.principal_amount > 0
      ? Math.min((paid / item.principal_amount) * 100, 100)
      : 0;
    const typeColor = TYPE_COLORS[item.type] || "#6b7280";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.debtName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: typeColor }]}>
            <Text style={styles.badgeText}>{TYPE_LABELS[item.type] || item.type}</Text>
          </View>
        </View>

        {item.lender && (
          <Text style={styles.lenderText}>{item.lender}</Text>
        )}

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: "#22c55e" }]} />
        </View>

        <Text style={styles.progressText}>
          Paid {formatCurrency(paid)} / {formatCurrency(item.principal_amount)} ({Math.round(progress)}%)
        </Text>

        <Text style={styles.balanceText}>
          Outstanding: {formatCurrency(item.current_balance)}
        </Text>

        {item.minimum_payment != null && item.minimum_payment > 0 && (
          <Text style={styles.emiText}>
            {formatCurrency(item.minimum_payment)}/month
            {item.due_date ? ` | Due: ${formatDate(item.due_date)}` : ""}
          </Text>
        )}

        {item.status === "paid_off" && (
          <View style={[styles.badge, { backgroundColor: "#22c55e", alignSelf: "flex-start", marginTop: 4 }]}>
            <Text style={styles.badgeText}>Paid Off</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#0d9488" }]}
            onPress={() => handleLogPayment(item)}
          >
            <Text style={styles.actionBtnText}>Log Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#f87171" }]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionBtnText}>Delete</Text>
          </TouchableOpacity>
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
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Debt</Text>
          <Text style={styles.summaryAmountRed}>{formatCurrency(totalDebt)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryCount}>{activeDebts.length}</Text>
        </View>
      </View>

      {/* Debts List */}
      <FlatList
        data={debts}
        keyExtractor={(item) => item.id}
        renderItem={renderDebt}
        contentContainerStyle={debts.length === 0 ? styles.centered : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No Debts Tracked</Text>
            <Text style={styles.emptySubtitle}>Start tracking to become debt-free!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0d9488"]} />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddDebt")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Payment for {selectedDebt?.name}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Payment Amount"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#6b7280" }]}
                onPress={() => setPaymentModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#0d9488" }]}
                onPress={confirmPayment}
              >
                <Text style={styles.modalBtnText}>Log</Text>
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
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: { alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  summaryAmountRed: { color: "#fca5a5", fontSize: 24, fontWeight: "bold", marginTop: 4 },
  summaryCount: { color: "#fff", fontSize: 24, fontWeight: "bold", marginTop: 4 },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  debtName: { fontSize: 16, fontWeight: "bold", color: "#1f2937", flex: 1, marginRight: 8 },
  lenderText: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
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
  progressText: { fontSize: 13, color: "#1f2937", marginBottom: 2 },
  balanceText: { fontSize: 15, fontWeight: "bold", color: "#f87171", marginBottom: 4 },
  emiText: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
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
