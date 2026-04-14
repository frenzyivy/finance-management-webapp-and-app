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
import {
  SUBSCRIPTION_CATEGORIES,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
} from "../lib/business-constants";
import type { BusinessSubscription } from "../types/business";

function getCategoryLabel(value: string): string {
  return SUBSCRIPTION_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getBillingCycleLabel(value: string): string {
  return BILLING_CYCLES.find((c) => c.value === value)?.label ?? value;
}

function getStatusLabel(value: string): string {
  return SUBSCRIPTION_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "#10b981";
    case "trial":
      return "#f59e0b";
    case "paused":
      return "#6b7280";
    case "cancelled":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function getRenewalUrgency(renewalDate: string): { label: string; bg: string; fg: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return { label: "Overdue", bg: "#fee2e2", fg: "#b91c1c" };
  if (diffDays === 0) return { label: "Due today", bg: "#fee2e2", fg: "#b91c1c" };
  if (diffDays === 1) return { label: "Tomorrow", bg: "#fef3c7", fg: "#b45309" };
  if (diffDays <= 3) return { label: `In ${diffDays} days`, bg: "#fef3c7", fg: "#b45309" };
  if (diffDays <= 7) return { label: `In ${diffDays} days`, bg: "#dbeafe", fg: "#1d4ed8" };
  return null;
}

export function BusinessSubscriptionsScreen() {
  const navigation = useNavigation<any>();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<BusinessSubscription[]>([]);
  const [monthlyBurn, setMonthlyBurn] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      const items: BusinessSubscription[] = data ?? [];
      setEntries(items);
      const activeBurn = items
        .filter((s) => s.status === "active" || s.status === "trial")
        .reduce((sum, s) => sum + s.monthly_equivalent, 0);
      setMonthlyBurn(activeBurn);
    } catch (err) {
      console.error("Business subscriptions fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

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

  const handleLongPress = useCallback(
    (entry: BusinessSubscription) => {
      Alert.alert(
        entry.name,
        `${formatCurrency(entry.cost_amount)} / ${getBillingCycleLabel(entry.billing_cycle)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () => navigation.navigate("AddBusinessSubscription", { entry }),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("business_subscriptions")
                  .delete()
                  .eq("id", entry.id);
                if (error) throw error;
                fetchData();
              } catch (err: any) {
                Alert.alert("Error", err.message ?? "Failed to delete subscription");
              }
            },
          },
        ]
      );
    },
    [fetchData, navigation]
  );

  const renderItem = ({ item }: { item: BusinessSubscription }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <TouchableOpacity
        style={styles.entryRow}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.entryLeft}>
          <Text style={styles.entryName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.entryMeta}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {getCategoryLabel(item.category)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            {item.status === "active" && (() => {
              const urgency = getRenewalUrgency(item.next_renewal_date);
              if (!urgency) return null;
              return (
                <View style={[styles.statusBadge, { backgroundColor: urgency.bg }]}>
                  <Text style={[styles.statusText, { color: urgency.fg }]}>
                    {urgency.label}
                  </Text>
                </View>
              );
            })()}
          </View>
          <Text style={styles.entryDetail}>
            {formatCurrency(item.cost_amount)} / {getBillingCycleLabel(item.billing_cycle)}
            {"  "}({formatCurrency(item.monthly_equivalent)}/mo)
          </Text>
          <Text style={styles.entryDate}>
            Next renewal: {formatDate(item.next_renewal_date)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        <View>
          <Text style={styles.summaryLabel}>Monthly Burn</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(monthlyBurn)}/mo
          </Text>
        </View>
        {(() => {
          const urgentCount = entries.filter(
            (e) => e.status === "active" && getRenewalUrgency(e.next_renewal_date) !== null
          ).length;
          if (urgentCount === 0) return null;
          return (
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingBadgeText}>
                {urgentCount} upcoming
              </Text>
            </View>
          );
        })()}
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
            tintColor="#185FA5"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No subscriptions tracked yet.</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first subscription.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddBusinessSubscription")}
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
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  summaryBar: {
    backgroundColor: "#185FA5",
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
  upcomingBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  upcomingBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  entryRow: {
    backgroundColor: "#fff",
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
  },
  entryName: {
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
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#185FA5",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  entryDetail: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 2,
  },
  entryDate: {
    fontSize: 12,
    color: "#6b7280",
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
    backgroundColor: "#185FA5",
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
