import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  SummaryBanner,
  TabSwitcher,
  TransactionCard,
  SectionHeader,
  CategoryBreakdownRow,
  CATEGORY_COLORS,
  formatINR,
} from "../components/komal";
import type { IncomeEntry } from "../types/database";

type TabKey = "all" | "salary" | "freelance" | "side_income" | "other";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "salary", label: "Salary" },
  { key: "freelance", label: "Freelance" },
  { key: "side_income", label: "Side Income" },
  { key: "other", label: "Other" },
];

function getCategoryLabel(v: string): string {
  return INCOME_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function getPaymentLabel(v: string | null): string {
  if (!v) return "";
  return PAYMENT_METHODS.find((p) => p.value === v)?.label ?? v;
}

type NavProp = NativeStackNavigationProp<Record<string, object | undefined>>;

export function IncomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [tab, setTab] = useState<TabKey>("all");

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
        .from("income_entries")
        .select("*")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;
      const items: IncomeEntry[] = data ?? [];
      setEntries(items);
      setTotalThisMonth(items.reduce((s, i) => s + i.amount, 0));
    } catch (err) {
      console.error("Income fetch error:", err);
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

  const filtered = useMemo(() => {
    if (tab === "all") return entries;
    return entries.filter((e) => e.category === tab);
  }, [entries, tab]);

  const sources = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
    return [...totals.entries()]
      .map(([cat, amt]) => ({ cat, amt, percent: (amt / sum) * 100 }))
      .sort((a, b) => b.amt - a.amt);
  }, [entries]);

  const handleLongPress = useCallback(
    (entry: IncomeEntry) => {
      Alert.alert(entry.source_name, formatINR(entry.amount), [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => navigation.navigate("AddIncome", { entry }),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("income_entries")
                .delete()
                .eq("id", entry.id);
              if (error) throw error;
              fetchData();
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Failed to delete entry";
              Alert.alert("Error", message);
            }
          },
        },
      ]);
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: navHeight + 40 + insets.bottom,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <PageHeader
        title="Income"
        actions={
          <Pressable
            onPress={() => navigation.navigate("AddIncome")}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </Pressable>
        }
      />

      <SummaryBanner
        label="This Month"
        value={totalThisMonth}
        tone="income"
        emoji="💰"
      />

      <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />

      {filtered.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No entries yet. Tap + to add one.
        </Text>
      ) : (
        filtered.map((entry) => (
          <TransactionCard
            key={entry.id}
            name={entry.source_name}
            kind="income"
            category={entry.category}
            categoryLabel={getCategoryLabel(entry.category)}
            metaTag={
              entry.is_auto_generated
                ? "Auto"
                : entry.is_recurring
                ? "Recurring"
                : undefined
            }
            metaTagTone={entry.is_auto_generated ? "muted" : "default"}
            date={format(new Date(entry.date), "d MMM")}
            method={getPaymentLabel(entry.payment_method)}
            amount={entry.amount}
            onPress={() => handleLongPress(entry)}
          />
        ))
      )}

      {sources.length > 0 && (
        <>
          <View style={{ marginTop: 24 }}>
            <SectionHeader title="Sources" />
          </View>
          {sources.map((s) => (
            <CategoryBreakdownRow
              key={s.cat}
              name={getCategoryLabel(s.cat)}
              color={CATEGORY_COLORS[s.cat] || colors.accent}
              amount={s.amt}
              percent={s.percent}
            />
          ))}
        </>
      )}
    </ScrollView>
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
  empty: {
    textAlign: "center",
    marginHorizontal: 24,
    marginVertical: 32,
    fontSize: 13,
  },
});
