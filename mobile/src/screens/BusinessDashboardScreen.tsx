import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import {
  BUSINESS_INCOME_CATEGORIES,
  BUSINESS_EXPENSE_CATEGORIES,
} from "../lib/business-constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  TransactionCard,
  SectionHeader,
  formatINR,
} from "../components/komal";
import type {
  BusinessIncome,
  BusinessExpense,
  BusinessSubscription,
} from "../types/business";

type Transaction = {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
};

function getCategoryLabel(
  value: string,
  type: "income" | "expense"
): string {
  const list =
    type === "income"
      ? BUSINESS_INCOME_CATEGORIES
      : BUSINESS_EXPENSE_CATEGORIES;
  return list.find((c) => c.value === value)?.label ?? value;
}

export function BusinessDashboardScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [subscriptionBurn, setSubscriptionBurn] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const [incomeRes, expenseRes, subsRes] = await Promise.all([
        supabase
          .from("business_income")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("business_expenses")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("business_subscriptions")
          .select("*")
          .eq("status", "active"),
      ]);

      const incomeData: BusinessIncome[] = incomeRes.data ?? [];
      const expenseData: BusinessExpense[] = expenseRes.data ?? [];
      const subsData: BusinessSubscription[] = subsRes.data ?? [];

      const revenueTotal = incomeData.reduce((s, i) => s + i.amount, 0);
      const expenseTotal = expenseData.reduce((s, e) => s + e.amount, 0);
      const burnTotal = subsData.reduce(
        (s, sub) => s + sub.monthly_equivalent,
        0
      );

      setTotalRevenue(revenueTotal);
      setTotalExpenses(expenseTotal);
      setSubscriptionBurn(burnTotal);

      const merged: Transaction[] = [
        ...incomeData.map((i) => ({
          id: i.id,
          type: "income" as const,
          description: i.source_name,
          category: i.category,
          date: i.date,
          amount: i.amount,
        })),
        ...expenseData.map((e) => ({
          id: e.id,
          type: "expense" as const,
          description: e.vendor_name,
          category: e.category,
          date: e.date,
          amount: e.amount,
        })),
      ];
      merged.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(merged.slice(0, 10));
    } catch (err) {
      console.error("Business dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const netProfit = totalRevenue - totalExpenses;

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
          title="Allianza Biz"
          eyebrow="Business finance overview"
          actions={
            <Pressable
              onPress={() => navigation.navigate("AddBusinessIncome")}
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

        {/* Summary Cards */}
        <View style={styles.cardGrid}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              Revenue
            </Text>
            <Text
              style={[
                styles.cardAmount,
                { color: colors.income },
              ]}
            >
              {formatINR(totalRevenue)}
            </Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              Expenses
            </Text>
            <Text
              style={[
                styles.cardAmount,
                { color: colors.expense },
              ]}
            >
              {formatINR(totalExpenses)}
            </Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              Net Profit
            </Text>
            <Text
              style={[
                styles.cardAmount,
                {
                  color: netProfit >= 0 ? colors.income : colors.expense,
                },
              ]}
            >
              {formatINR(netProfit)}
            </Text>
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              Subscription Burn
            </Text>
            <Text
              style={[
                styles.cardAmount,
                { color: colors.warning },
              ]}
            >
              {formatINR(subscriptionBurn)}/mo
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => navigation.navigate("AddBusinessIncome")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={[styles.quickActionIcon, { color: colors.accent }]}
            >
              +
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textPrimary, fontWeight: "600" },
              ]}
            >
              Add Income
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("AddBusinessExpense")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={[styles.quickActionIcon, { color: colors.accent }]}
            >
              +
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textPrimary, fontWeight: "600" },
              ]}
            >
              Add Expense
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("BusinessSubscriptions")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={[styles.quickActionIcon, { color: colors.accent }]}
            >
              S
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textPrimary, fontWeight: "600" },
              ]}
            >
              Subscriptions
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("BusinessClients")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={[styles.quickActionIcon, { color: colors.accent }]}
            >
              C
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textPrimary, fontWeight: "600" },
              ]}
            >
              Clients
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Transfers")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={[styles.quickActionIcon, { color: colors.accent }]}
            >
              ⇄
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textPrimary, fontWeight: "600" },
              ]}
            >
              Transfers
            </Text>
          </Pressable>
        </View>

        {/* Recent Transactions */}
        <SectionHeader title="Recent Business Transactions" />
        {transactions.length === 0 ? (
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginHorizontal: 24,
              marginVertical: 24,
              fontFamily: typography.caption.fontFamily,
              fontSize: 13,
            }}
          >
            No business transactions this month yet.
          </Text>
        ) : (
          transactions.map((txn) => (
            <TransactionCard
              key={`${txn.type}-${txn.id}`}
              name={txn.description}
              kind={txn.type}
              category={txn.category}
              categoryLabel={getCategoryLabel(txn.category, txn.type)}
              date={format(new Date(txn.date), "d MMM")}
              amount={txn.amount}
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
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  card: {
    width: "48%",
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 16,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  quickAction: {
    width: "48%",
    borderRadius: radii.sm,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  quickActionIcon: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
});
