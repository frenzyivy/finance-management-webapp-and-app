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
import { format, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  SummaryBanner,
  TabSwitcher,
  MonthFilter,
  TransactionCard,
  formatINR,
} from "../components/komal";
import type { ExpenseEntry } from "../types/database";

type TabKey = "all" | "rent" | "food_groceries" | "utilities" | "shopping";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "rent", label: "Rent" },
  { key: "food_groceries", label: "Food" },
  { key: "utilities", label: "Utilities" },
  { key: "shopping", label: "Shopping" },
];

function getCategoryLabel(v: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function getPaymentLabel(v: string | null): string {
  if (!v) return "";
  return PAYMENT_METHODS.find((p) => p.value === v)?.label ?? v;
}

function mapExpenseCategory(cat: string): string {
  switch (cat) {
    case "food_groceries":
      return "food";
    case "credit_card_payments":
      return "credit_card";
    case "emis":
      return "emi";
    case "family_personal":
      return "family";
    case "debt_repayment":
      return "credit_card";
    default:
      return cat;
  }
}

type NavProp = NativeStackNavigationProp<Record<string, object | undefined>>;

export function ExpensesScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [monthFilter, setMonthFilter] = useState<string>(() =>
    format(new Date(), "yyyy-MM")
  );

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      const items: ExpenseEntry[] = data ?? [];
      setEntries(items);
    } catch (err) {
      console.error("Expenses fetch error:", err);
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
    return entries.filter((e) => {
      const catOk = tab === "all" || e.category === tab;
      const monthOk = monthFilter === "all" || e.date.startsWith(monthFilter);
      return catOk && monthOk;
    });
  }, [entries, tab, monthFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );

  const availableMonths = useMemo(() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const set = new Set<string>();
    for (const e of entries) set.add(e.date.slice(0, 7));
    // Anchor on the current month: drop anything in the future.
    const pastOrCurrent = Array.from(set)
      .filter((m) => m <= currentMonth)
      .sort()
      .reverse();
    const withCurrent = pastOrCurrent.includes(currentMonth)
      ? pastOrCurrent
      : [currentMonth, ...pastOrCurrent].sort().reverse();
    if (monthFilter !== "all" && !withCurrent.includes(monthFilter)) {
      return [monthFilter, ...withCurrent].sort().reverse();
    }
    return withCurrent;
  }, [entries, monthFilter]);

  const bannerLabel = useMemo(() => {
    const monthLabel =
      monthFilter === "all"
        ? "All time"
        : format(parseISO(monthFilter + "-01"), "MMMM yyyy");
    const catLabel = tab === "all" ? null : TABS.find((t) => t.key === tab)?.label ?? null;
    return catLabel ? `${monthLabel} · ${catLabel}` : monthLabel;
  }, [monthFilter, tab]);

  const handleLongPress = useCallback(
    (entry: ExpenseEntry) => {
      Alert.alert(entry.payee_name ?? "Expense", formatINR(entry.amount), [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => navigation.navigate("AddExpense", { entry }),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("expense_entries")
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
        title="Expenses"
        actions={
          <Pressable
            onPress={() => navigation.navigate("AddExpense")}
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
        label={bannerLabel}
        value={filteredTotal}
        tone="expense"
        emoji="💸"
      />

      <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />
      <MonthFilter
        value={monthFilter}
        onChange={setMonthFilter}
        months={availableMonths}
      />

      {filtered.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No expenses match this view. Tap + to add one.
        </Text>
      ) : (
        filtered.map((entry) => (
          <TransactionCard
            key={entry.id}
            name={entry.payee_name ?? "Expense"}
            kind="expense"
            category={mapExpenseCategory(entry.category)}
            categoryLabel={getCategoryLabel(entry.category)}
            metaTag={
              entry.is_auto_generated
                ? "Auto"
                : entry.funding_source === "debt_funded"
                ? "Debt"
                : entry.funding_source === "debt_repayment"
                ? "EMI"
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
