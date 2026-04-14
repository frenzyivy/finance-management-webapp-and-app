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
import { formatCurrency } from "../lib/format";
import {
  CLIENT_STATUSES,
  ENGAGEMENT_TYPES,
} from "../lib/business-constants";
import type { BusinessClient } from "../types/business";

function getStatusLabel(value: string): string {
  return CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function getEngagementLabel(value: string | null): string {
  if (!value) return "";
  return ENGAGEMENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "#10b981";
    case "prospect":
      return "#3b82f6";
    case "paused":
      return "#f59e0b";
    case "churned":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

export function BusinessClientsScreen() {
  const navigation = useNavigation<any>();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<BusinessClient[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("business_clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      setEntries((data ?? []) as BusinessClient[]);
    } catch (err) {
      console.error("Business clients fetch error:", err);
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
    (entry: BusinessClient) => {
      Alert.alert(
        entry.name,
        getStatusLabel(entry.status),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () => navigation.navigate("AddBusinessClient", { entry }),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("business_clients")
                  .delete()
                  .eq("id", entry.id);
                if (error) throw error;
                fetchData();
              } catch (err: any) {
                Alert.alert("Error", err.message ?? "Failed to delete client");
              }
            },
          },
        ]
      );
    },
    [fetchData, navigation]
  );

  const renderItem = ({ item }: { item: BusinessClient }) => {
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
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            {item.engagement_type && (
              <Text style={styles.engagementType}>
                {getEngagementLabel(item.engagement_type)}
              </Text>
            )}
          </View>
          <View style={styles.detailRow}>
            {item.industry && (
              <Text style={styles.detailText}>{item.industry}</Text>
            )}
            {item.country && (
              <Text style={styles.detailText}>{item.country}</Text>
            )}
          </View>
        </View>
        {item.monthly_value != null && item.monthly_value > 0 && (
          <Text style={styles.monthlyValue}>
            {formatCurrency(item.monthly_value)}/mo
          </Text>
        )}
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
            <Text style={styles.emptyText}>No clients tracked yet.</Text>
            <Text style={styles.emptyHint}>
              Tap the + button to add your first client.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AddBusinessClient")}
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
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
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
    marginRight: 8,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  engagementType: {
    fontSize: 11,
    color: "#6b7280",
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
  },
  detailText: {
    fontSize: 12,
    color: "#6b7280",
  },
  monthlyValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
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
