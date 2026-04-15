import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";
import {
  HeroBalanceCard,
  QuickActionBar,
  StatPillRow,
  SectionHeader,
  TransactionCard,
  formatINR,
} from "../components/komal";
import type { IncomeEntry, ExpenseEntry, SavingsGoal } from "../types/database";
import { format } from "date-fns";

type Transaction = {
  id: string;
  kind: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
  method?: string | null;
};

function getCategoryLabel(
  value: string,
  type: "income" | "expense"
): string {
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.value === value)?.label ?? value;
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

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState<string>("there");

  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const displayName =
        (userData?.user?.user_metadata?.full_name as string | undefined) ||
        (userData?.user?.user_metadata?.name as string | undefined) ||
        userData?.user?.email?.split("@")[0] ||
        "there";
      setUserName(displayName);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const [incomeRes, expenseRes, goalsRes] = await Promise.all([
        supabase
          .from("income_entries")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("expense_entries")
          .select("*")
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
          .order("date", { ascending: false }),
        supabase
          .from("savings_goals")
          .select("*")
          .eq("status", "active"),
      ]);

      const incomeData: IncomeEntry[] = incomeRes.data ?? [];
      const expenseData: ExpenseEntry[] = expenseRes.data ?? [];
      const goalsData: SavingsGoal[] = goalsRes.data ?? [];

      setTotalIncome(incomeData.reduce((s, i) => s + i.amount, 0));
      setTotalExpenses(expenseData.reduce((s, e) => s + e.amount, 0));
      setTotalSavings(goalsData.reduce((s, g) => s + g.current_balance, 0));

      const merged: Transaction[] = [
        ...incomeData.map((i) => ({
          id: i.id,
          kind: "income" as const,
          description: i.source_name,
          category: i.category,
          date: i.date,
          amount: i.amount,
          method: i.payment_method,
        })),
        ...expenseData.map((e) => ({
          id: e.id,
          kind: "expense" as const,
          description: e.payee_name ?? "Expense",
          category: mapExpenseCategory(e.category),
          date: e.date,
          amount: e.amount,
          method: e.payment_method,
        })),
      ];
      merged.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(merged.slice(0, 6));
    } catch (err) {
      console.error("Dashboard fetch error:", err);
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

  const netCashFlow = totalIncome - totalExpenses;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
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
      <View
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Hi,
          </Text>
          <Text
            style={[
              typography.greetingName,
              { color: colors.textPrimary, marginTop: 2 },
            ]}
          >
            {userName}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => navigation.navigate("Settings" as never)}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.61.78 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.73 0-1.31.39-1.51 1Z" />
            </Svg>
          </Pressable>
        </View>
      </View>

      <HeroBalanceCard
        netAmount={netCashFlow}
        income={totalIncome}
        expense={totalExpenses}
      />

      <QuickActionBar
        actions={[
          {
            label: "Import",
            onPress: () => navigation.navigate("Imports" as never),
            icon: (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <Path d="m7 10 5 5 5-5M12 15V3" />
              </Svg>
            ),
          },
          {
            label: "Scan SMS",
            onPress: () => navigation.navigate("SmsScan" as never),
            icon: (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
                <Path d="M12 18h.01" />
              </Svg>
            ),
          },
          {
            label: "Analytics",
            onPress: () => navigation.navigate("Analytics" as never),
            icon: (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
              </Svg>
            ),
          },
        ]}
      />

      <StatPillRow
        stats={[
          {
            label: "Savings",
            value: formatINR(totalSavings),
            tone: totalSavings === 0 ? "zero" : "default",
          },
          {
            label: "This Month",
            value: formatINR(Math.abs(netCashFlow)),
            tone: netCashFlow < 0 ? "negative" : "default",
          },
        ]}
      />

      <SectionHeader
        title="Recent"
        linkLabel="View All"
        onLinkPress={() => navigation.navigate("Expenses" as never)}
      />

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
          No transactions this month yet. Tap + to add one.
        </Text>
      ) : (
        transactions.map((tx) => (
          <TransactionCard
            key={`${tx.kind}-${tx.id}`}
            name={tx.description}
            kind={tx.kind}
            category={tx.category}
            categoryLabel={getCategoryLabel(tx.category, tx.kind)}
            date={format(new Date(tx.date), "d MMM")}
            amount={tx.amount}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
