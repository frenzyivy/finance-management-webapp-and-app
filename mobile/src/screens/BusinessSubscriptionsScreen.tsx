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
import { formatDate } from "../lib/format";
import {
  SUBSCRIPTION_CATEGORIES,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
} from "../lib/business-constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { SummaryBanner, formatINR } from "../components/komal";
import type { ThemeColors } from "../lib/colors";
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

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "active":
      return colors.income;
    case "trial":
      return colors.warning;
    case "paused":
      return colors.textSecondary;
    case "cancelled":
      return colors.expense;
    default:
      return colors.textSecondary;
  }
}

function getRenewalUrgency(
  renewalDate: string,
  colors: ThemeColors
): { label: string; bg: string; fg: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0)
    return { label: "Overdue", bg: colors.expenseLight, fg: colors.expense };
  if (diffDays === 0)
    return { label: "Due today", bg: colors.expenseLight, fg: colors.expense };
  if (diffDays === 1)
    return { label: "Tomorrow", bg: colors.surfaceAlt, fg: colors.warning };
  if (diffDays <= 3)
    return {
      label: `In ${diffDays} days`,
      bg: colors.surfaceAlt,
      fg: colors.warning,
    };
  if (diffDays <= 7)
    return {
      label: `In ${diffDays} days`,
      bg: colors.surfaceAlt,
      fg: colors.textSecondary,
    };
  return null;
}

export function BusinessSubscriptionsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
        `${formatINR(entry.cost_amount)} / ${getBillingCycleLabel(entry.billing_cycle)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () =>
              navigation.navigate("AddBusinessSubscription", { entry }),
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
                Alert.alert(
                  "Error",
                  err.message ?? "Failed to delete subscription"
                );
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
          title="Subscriptions"
          eyebrow="Recurring expenses"
          actions={
            <Pressable
              onPress={() => navigation.navigate("AddBusinessSubscription")}
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

        <SummaryBanner
          label="Monthly Burn"
          value={monthlyBurn}
          tone="neutral"
          emoji="🔁"
        />

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              No subscriptions tracked yet.
            </Text>
            <Text
              style={[typography.caption, { color: colors.textTertiary }]}
            >
              Tap the + button to add your first subscription.
            </Text>
          </View>
        ) : (
          entries.map((item) => {
            const statusColor = getStatusColor(item.status, colors);
            const urgency =
              item.status === "active"
                ? getRenewalUrgency(item.next_renewal_date, colors)
                : null;
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
                        { color: colors.textSecondary },
                      ]}
                    >
                      {getCategoryLabel(item.category)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    <Text
                      style={[styles.pillText, { color: statusColor }]}
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                  {urgency ? (
                    <View
                      style={[styles.pill, { backgroundColor: urgency.bg }]}
                    >
                      <Text
                        style={[styles.pillText, { color: urgency.fg }]}
                      >
                        {urgency.label}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: 6 },
                  ]}
                >
                  {formatINR(item.cost_amount)} /{" "}
                  {getBillingCycleLabel(item.billing_cycle)}
                  {"  "}({formatINR(item.monthly_equivalent)}/mo)
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, marginTop: 2 },
                  ]}
                >
                  Next renewal: {formatDate(item.next_renewal_date)}
                </Text>
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
    gap: 6,
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    marginHorizontal: 24,
  },
});
