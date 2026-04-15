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
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  SummaryBanner,
  TabSwitcher,
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
        .from("expense_entries")
        .select("*")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false });

      if (error) throw error;
      const items: ExpenseEntry[] = data ?? [];
      setEntries(items);
      setTotalThisMonth(items.reduce((s, e) => s + e.amount, 0));
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
    if (tab === "all") return entries;
    return entries.filter((e) => e.category === tab);
  }, [entries, tab]);

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
        label="This Month"
        value={totalThisMonth}
        tone="expense"
        emoji="💸"
      />

      <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />

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
