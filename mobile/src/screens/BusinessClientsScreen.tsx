import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import {
  CLIENT_STATUSES,
  ENGAGEMENT_TYPES,
} from "../lib/business-constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";
import type { ThemeColors } from "../lib/colors";
import type { BusinessClient } from "../types/business";

function getStatusLabel(value: string): string {
  return CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function getEngagementLabel(value: string | null): string {
  if (!value) return "";
  return ENGAGEMENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "active":
      return colors.income;
    case "prospect":
      return colors.blue;
    case "paused":
      return colors.warning;
    case "churned":
      return colors.expense;
    default:
      return colors.textSecondary;
  }
}

export function BusinessClientsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <PageHeader
          title="Clients"
          actions={
            <Pressable
              onPress={() => navigation.navigate("AddBusinessClient")}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
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

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              No clients tracked yet.
            </Text>
            <Text
              style={[typography.caption, { color: colors.textTertiary }]}
            >
              Tap the + button to add your first client.
            </Text>
          </View>
        ) : (
          entries.map((item) => {
            const statusColor = getStatusColor(item.status, colors);
            return (
              <Pressable
                key={item.id}
                onLongPress={() => handleLongPress(item)}
                style={({ pressed }) => [
                  styles.entryRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.body,
                      {
                        color: colors.textPrimary,
                        fontWeight: "600",
                        marginBottom: 6,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.entryMeta}>
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: colors.surfaceAlt },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: statusColor },
                        ]}
                      >
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                    {item.engagement_type ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textTertiary },
                        ]}
                      >
                        {getEngagementLabel(item.engagement_type)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.detailRow}>
                    {item.industry ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textTertiary },
                        ]}
                      >
                        {item.industry}
                      </Text>
                    ) : null}
                    {item.country ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textTertiary },
                        ]}
                      >
                        {item.country}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {item.monthly_value != null && item.monthly_value > 0 ? (
                  <Text
                    style={[
                      typography.body,
                      { color: colors.income, fontWeight: "700" },
                    ]}
                  >
                    {formatINR(item.monthly_value)}/mo
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  entryMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    marginHorizontal: 24,
  },
});
