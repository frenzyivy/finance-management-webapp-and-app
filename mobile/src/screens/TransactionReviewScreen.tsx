import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "../lib/constants";
import { PickerModal } from "../components/PickerModal";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "../components/PageHeader";
import { formatINR, TransactionCard } from "../components/komal";
import type {
  LocalParsedTransaction,
  ImportedTransaction,
} from "../types/database";

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        const remaining = localItems.filter((t) => t.local_id !== entry.id);
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
    Alert.alert(
      "Reject Transaction",
      "This will remove it from your device. It was never sent to any server.",
      [
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
      ]
    );
  }

  const activeEntry = entries.find((e) => e.id === activeEntryId);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader title="Review Imports" />

      {/* Stats */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary },
          ]}
        >
          {entries.length} pending transaction{entries.length !== 1 ? "s" : ""}
          {" (on device only)"}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={[styles.centered, { paddingHorizontal: 32 }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginBottom: 8 },
            ]}
          >
            All caught up!
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary },
            ]}
          >
            No pending transactions to review.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: navHeight + 40 + insets.bottom,
            paddingHorizontal: 24,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const cat =
              categoryMap[item.id] ||
              item.assigned_category ||
              (item.parsed_type === "debit" ? "miscellaneous" : "other");
            const kind = item.parsed_type === "debit" ? "expense" : "income";

            return (
              <View style={{ marginBottom: 14 }}>
                {/* Use TransactionCard — override its horizontal margin via wrapper */}
                <View style={{ marginHorizontal: -24 }}>
                  <TransactionCard
                    name={
                      item.parsed_description ||
                      item.parsed_reference ||
                      "Unknown"
                    }
                    kind={kind}
                    category={item.parsed_type === "debit" ? cat : cat}
                    categoryLabel={getCategoryLabel(cat, item.parsed_type)}
                    metaTag={
                      item.import_source === "sms" ? "SMS" : "Statement"
                    }
                    metaTagTone="muted"
                    date={format(new Date(item.parsed_date), "d MMM")}
                    amount={item.parsed_amount}
                    onPress={() => openCategoryPicker(item.id)}
                  />
                </View>

                {/* Action Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => handleApprove(item)}
                    disabled={approvingId === item.id}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        backgroundColor: colors.accent,
                        borderRadius: 100,
                        paddingVertical: 12,
                        alignItems: "center",
                        opacity: approvingId === item.id ? 0.5 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    {approvingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: fonts.sansSemibold,
                          fontSize: 13,
                          color: "#fff",
                        }}
                      >
                        Approve
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleReject(item.id)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: 100,
                        paddingVertical: 12,
                        alignItems: "center",
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.sansSemibold,
                        fontSize: 13,
                        color: colors.expense,
                      }}
                    >
                      Reject
                    </Text>
                  </Pressable>
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
            ? INCOME_CATEGORIES.map((c) => ({
                label: c.label,
                value: c.value,
              }))
            : EXPENSE_CATEGORIES.map((c) => ({
                label: c.label,
                value: c.value,
              }))
        }
        selectedValue={activeEntryId ? categoryMap[activeEntryId] || "" : ""}
        onSelect={handleCategorySelect}
        onClose={() => setCategoryPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
