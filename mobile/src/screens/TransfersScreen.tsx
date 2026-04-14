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
import { useSyncStore } from "../lib/sync-store";
import { formatCurrency, formatDate } from "../lib/format";
import type { PersonalBusinessTransfer } from "../types/business";

export function TransfersScreen() {
  const navigation = useNavigation<any>();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<PersonalBusinessTransfer[]>([]);
  const [personalToBusiness, setPersonalToBusiness] = useState(0);
  const [businessToPersonal, setBusinessToPersonal] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("personal_business_transfers")
        .select("*")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      const items = (data ?? []) as PersonalBusinessTransfer[];
      setEntries(items);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const thisMonth = items.filter((e) => e.date >= monthStart);
      setPersonalToBusiness(
        thisMonth
          .filter((e) => e.direction === "personal_to_business")
          .reduce((s, e) => s + e.amount, 0)
      );
      setBusinessToPersonal(
        thisMonth
          .filter((e) => e.direction === "business_to_personal")
          .reduce((s, e) => s + e.amount, 0)
      );
    } catch (err) {
      console.error("Transfers fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchData());
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLongPress = (t: PersonalBusinessTransfer) => {
    Alert.alert(
      t.reason,
      `${formatCurrency(t.amount)} • ${formatDate(t.date)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("personal_business_transfers")
                .delete()
                .eq("id", t.id);
              if (error) throw error;
              fetchData();
            } catch (err: any) {
              Alert.alert("Error", err.message ?? "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PersonalBusinessTransfer }) => {
    const isP2B = item.direction === "personal_to_business";
    return (
      <TouchableOpacity
        style={styles.entryRow}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isP2B ? "#dbeafe" : "#d1fae5" },
          ]}
        >
          <Text style={[styles.iconText, { color: isP2B ? "#1d4ed8" : "#059669" }]}>
            {isP2B ? "→" : "←"}
          </Text>
        </View>
        <View style={styles.entryLeft}>
          <Text style={styles.entryReason} numberOfLines={1}>{item.reason}</Text>
          <Text style={styles.entryMeta}>
            {formatDate(item.date)} • {isP2B ? "Personal → Business" : "Business → Personal"}
          </Text>
        </View>
        <Text
          style={[
            styles.entryAmount,
            { color: isP2B ? "#1d4ed8" : "#059669" },
          ]}
        >
          {formatCurrency(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const netFlow = businessToPersonal - personalToBusiness;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>To Business</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(personalToBusiness)}</Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>To Personal</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(businessToPersonal)}</Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryAmount, { color: netFlow >= 0 ? "#a7f3d0" : "#fecaca" }]}>
            {netFlow >= 0 ? "+" : ""}{formatCurrency(netFlow)}
          </Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#185FA5" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transfers yet.</Text>
            <Text style={styles.emptyHint}>
              Tap + to log a transfer between personal and business.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddTransfer")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  summaryBar: {
    backgroundColor: "#185FA5",
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCol: { flex: 1, alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "500" },
  summaryAmount: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 100 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconText: { fontSize: 18, fontWeight: "700" },
  entryLeft: { flex: 1, marginRight: 8 },
  entryReason: { fontSize: 14, fontWeight: "600", color: "#1f2937", marginBottom: 2 },
  entryMeta: { fontSize: 11, color: "#6b7280" },
  entryAmount: { fontSize: 15, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 15, color: "#6b7280", marginBottom: 4 },
  emptyHint: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#185FA5",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
  fabText: { fontSize: 28, color: "#fff", fontWeight: "300", marginTop: -2 },
});