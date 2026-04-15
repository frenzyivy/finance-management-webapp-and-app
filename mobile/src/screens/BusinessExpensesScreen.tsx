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
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { BUSINESS_EXPENSE_CATEGORIES } from "../lib/business-constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  SummaryBanner,
  TransactionCard,
  formatINR,
} from "../components/komal";
import type { BusinessExpense } from "../types/business";

function getCategoryLabel(value: string): string {
  return BUSINESS_EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function BusinessExpensesScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<BusinessExpense[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const { data, error } = await supabase
        .from("business_expenses")
        .select("*")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;

      const items: BusinessExpense[] = data ?? [];
      setEntries(items);
      setTotalThisMonth(items.reduce((s, e) => s + e.amount, 0));
    } catch (err) {
      console.error("Business expenses fetch error:", err);
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
    (entry: BusinessExpense) => {
      Alert.alert(
        entry.vendor_name,
        formatINR(entry.amount),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit",
            onPress: () => navigation.navigate("AddBusinessExpense", { entry }),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("business_expenses")
                  .delete()
                  .eq("id", entry.id);
                if (error) throw error;
                fetchData();
              } catch (err: any) {
                Alert.alert("Error", err.message ?? "Failed to delete entry");
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
          title="Business Expenses"
          actions={
            <Pressable
              onPress={() => navigation.navigate("AddBusinessExpense")}
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
          label="Total This Month"
          value={totalThisMonth}
          tone="expense"
          emoji="💸"
        />

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              No business expenses this month.
            </Text>
            <Text
              style={[typography.caption, { color: colors.textTertiary }]}
            >
              Tap the + button to add your first expense.
            </Text>
          </View>
        ) : (
          entries.map((item) => (
            <TransactionCard
              key={item.id}
              name={item.vendor_name}
              kind="expense"
              category={item.category}
              categoryLabel={getCategoryLabel(item.category)}
              metaTag={item.sub_category ?? undefined}
              metaTagTone="muted"
              date={format(new Date(item.date), "d MMM")}
              amount={item.amount}
              onPress={() => handleLongPress(item)}
            />
          ))
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    marginHorizontal: 24,
  },
});
