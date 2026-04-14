import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { formatCurrency, formatDate } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "../lib/constants";
import { PickerModal } from "../components/PickerModal";
import type { LocalParsedTransaction, ImportedTransaction } from "../types/database";

const LOCAL_STAGING_KEY = "komalfin_pending_imports";

async function loadLocalStaging(): Promise<LocalParsedTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_STAGING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalStaging(items: LocalParsedTransaction[]) {
  await AsyncStorage.setItem(LOCAL_STAGING_KEY, JSON.stringify(items));
}

/** Convert local staging item to ImportedTransaction shape for backward-compat rendering */
function toImportedTransaction(t: LocalParsedTransaction): ImportedTransaction {
  return {
    id: t.local_id,
    user_id: "",
    import_source: t.import_source,
    raw_text: t.description,
    import_batch_id: t.import_batch_id,
    parsed_amount: t.amount,
    parsed_type: t.transaction_type,
    parsed_date: t.date,
    parsed_reference: t.reference,
    parsed_account_hint: null,
    parsed_description: t.description,
    assigned_category: null,
    assigned_payee_name: null,
    assigned_payment_method: null,
    status: "pending",
    linked_expense_id: null,
    linked_income_id: null,
    dedup_hash: t.dedup_hash,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function TransactionReviewScreen({ navigation }: { navigation: any }) {
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localItems, setLocalItems] = useState<LocalParsedTransaction[]>([]);
  const [entries, setEntries] = useState<ImportedTransaction[]>([]);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string>("");
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const items = await loadLocalStaging();
      const pending = items.filter((t) => !t.is_duplicate);
      setLocalItems(pending);
      setEntries(pending.map(toImportedTransaction));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, syncVersion]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, [fetchEntries]);

  function openCategoryPicker(entryId: string) {
    setActiveEntryId(entryId);
    setCategoryPickerVisible(true);
  }

  function handleCategorySelect(value: string) {
    setCategoryMap((prev) => ({ ...prev, [activeEntryId]: value }));
    setCategoryPickerVisible(false);
  }

  function getCategoryLabel(value: string, type: string) {
    const list = type === "debit" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    return list.find((c) => c.value === value)?.label ?? value;
  }

  async function handleApprove(entry: ImportedTransaction) {
    const category =
      categoryMap[entry.id] ||
      entry.assigned_category ||
      (entry.parsed_type === "debit" ? "miscellaneous" : "other");

    const localItem = localItems.find((t) => t.local_id === entry.id);
    if (!localItem) return;

    setApprovingId(entry.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

      const res = await fetch(`${apiUrl}/api/imports/approve-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: [
            {
              amount: localItem.amount,
              transaction_type: localItem.transaction_type,
              date: localItem.date,
              description: localItem.description,
              reference: localItem.reference,
              dedup_hash: localItem.dedup_hash,
              assigned_category: category,
              assigned_payee_name: localItem.description || "Unknown",
              assigned_payment_method: "upi",
              import_source: localItem.import_source,
              import_batch_id: localItem.import_batch_id,
            },
          ],
        }),
      });

      if (res.ok) {
        // Remove from local staging
        const remaining = localItems.filter(
          (t) => t.local_id !== entry.id
        );
        setLocalItems(remaining);
        setEntries(remaining.map(toImportedTransaction));
        // Persist updated staging
        const allStaged = await loadLocalStaging();
        await saveLocalStaging(
          allStaged.filter((t) => t.local_id !== entry.id)
        );
      } else {
        const errText = await res.text();
        Alert.alert("Error", `Failed to approve: ${errText}`);
      }
    } catch {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(entryId: string) {
    Alert.alert("Reject Transaction", "This will remove it from your device. It was never sent to any server.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // Remove from local staging only — data never leaves the device
          const remaining = localItems.filter((t) => t.local_id !== entryId);
          setLocalItems(remaining);
          setEntries(remaining.map(toImportedTransaction));
          const allStaged = await loadLocalStaging();
          await saveLocalStaging(
            allStaged.filter((t) => t.local_id !== entryId)
          );
        },
      },
    ]);
  }

  const activeEntry = entries.find((e) => e.id === activeEntryId);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {entries.length} pending transaction{entries.length !== 1 ? "s" : ""}
          {" (on device only)"}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyDesc}>No pending transactions to review.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0d9488"
            />
          }
          renderItem={({ item }) => {
            const cat =
              categoryMap[item.id] ||
              item.assigned_category ||
              (item.parsed_type === "debit" ? "miscellaneous" : "other");

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          item.parsed_type === "debit" ? "#fee2e2" : "#dcfce7",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color:
                          item.parsed_type === "debit" ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {item.parsed_type === "debit" ? "EXPENSE" : "INCOME"}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {formatDate(item.parsed_date)}
                  </Text>
                  <View
                    style={[
                      styles.sourceBadge,
                      {
                        backgroundColor:
                          item.import_source === "sms" ? "#ede9fe" : "#e0f2fe",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color:
                          item.import_source === "sms" ? "#7c3aed" : "#0284c7",
                      }}
                    >
                      {item.import_source === "sms" ? "SMS" : "Statement"}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.cardAmount,
                    {
                      color:
                        item.parsed_type === "debit" ? "#dc2626" : "#16a34a",
                    },
                  ]}
                >
                  {item.parsed_type === "debit" ? "-" : "+"}
                  {formatCurrency(item.parsed_amount)}
                </Text>

                {item.parsed_description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.parsed_description}
                  </Text>
                )}

                {/* Category Selector */}
                <TouchableOpacity
                  style={styles.categoryRow}
                  onPress={() => openCategoryPicker(item.id)}
                >
                  <Text style={styles.categoryLabel}>Category:</Text>
                  <Text style={styles.categoryValue}>
                    {getCategoryLabel(cat, item.parsed_type)}
                  </Text>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.approveBtn, approvingId === item.id && styles.btnDisabled]}
                    onPress={() => handleApprove(item)}
                    disabled={approvingId === item.id}
                  >
                    {approvingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.approveBtnText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item.id)}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <PickerModal
        visible={categoryPickerVisible}
        title="Select Category"
        options={
          activeEntry?.parsed_type === "credit"
            ? INCOME_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))
            : EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))
        }
        selectedValue={
          activeEntryId ? categoryMap[activeEntryId] || "" : ""
        }
        onSelect={handleCategorySelect}
        onClose={() => setCategoryPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 32,
  },
  statsBar: {
    padding: 16,
    paddingBottom: 8,
  },
  statsText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  listContent: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardDate: { fontSize: 12, color: "#6b7280", flex: 1 },
  cardAmount: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  cardDesc: { fontSize: 13, color: "#4b5563", marginBottom: 10 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  categoryLabel: { fontSize: 13, color: "#6b7280", marginRight: 6 },
  categoryValue: { fontSize: 13, fontWeight: "600", color: "#374151", flex: 1 },
  changeText: { fontSize: 12, color: "#0d9488", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10 },
  approveBtn: {
    flex: 1,
    backgroundColor: "#0d9488",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#6b7280" },
});
