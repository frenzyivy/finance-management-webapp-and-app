import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useAnalytics } from "../hooks/useAnalytics";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import {
  ChartCard,
  DebtHealthGrid,
  SectionHeader,
  InsightCard,
  CategoryBreakdownRow,
  CATEGORY_COLORS,
  MonthlyBarChart,
  PairedBarChart,
  formatINR,
} from "../components/komal";

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function mapCategoryKey(cat: string): string {
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

export function AnalyticsScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    topCategories,
    monthlyTrend,
    totalDebt,
    monthlyDebtPayments,
    debtToIncomeRatio,
    monthsToDebtFree,
    loading,
    selectedMonth,
    setSelectedMonth,
  } = useAnalytics();

  const prevMonth = () =>
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)
    );
  const nextMonth = () =>
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1)
    );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const monthsOverBudget = monthlyTrend.filter(
    (m) => m.expenses > m.income && m.income > 0
  ).length;

  // Build last-12-months volume chart from monthlyTrend; fall back to whatever's available.
  const monthlyBars = monthlyTrend.map((m) => ({
    label: m.month.slice(0, 3),
    value: m.income + m.expenses,
  }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: navHeight + 40 + insets.bottom,
      }}
    >
      <PageHeader
        title="Analytics"
        actions={
          <>
            <Pressable
              onPress={prevMonth}
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
                <Path d="m15 18-6-6 6-6" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={nextMonth}
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
                <Path d="m9 18 6-6-6-6" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("YearReview" as never)}
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
                <Path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
              </Svg>
            </Pressable>
          </>
        }
      />

      <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
        <Text
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {formatMonthYear(selectedMonth)}
        </Text>
      </View>

      <ChartCard
        title="Monthly Activity"
        subtitle="Total volume across recent months"
        legend={[{ color: colors.accent, label: "Total" }]}
      >
        {monthlyBars.length > 0 ? (
          <MonthlyBarChart data={monthlyBars} />
        ) : (
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
            Not enough data yet.
          </Text>
        )}
      </ChartCard>

      <ChartCard
        title="6-Month Trend"
        subtitle="Income vs expenses"
        legend={[
          { color: colors.accent, label: "Income" },
          { color: colors.expense, label: "Expense" },
        ]}
      >
        {monthlyTrend.length > 0 ? (
          <PairedBarChart
            data={monthlyTrend.slice(-6).map((m) => ({
              label: m.month.slice(0, 3),
              income: m.income,
              expense: m.expenses,
            }))}
          />
        ) : (
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
            No trend data yet.
          </Text>
        )}
      </ChartCard>

      {monthlyTrend.length > 0 ? (
        <InsightCard emoji={monthsOverBudget > 0 ? "⚠️" : "🎉"}>
          {monthsOverBudget > 0
            ? `Expenses topped income in ${monthsOverBudget} of the last 6 months. Time to trim.`
            : "Income beat expenses in every one of the last 6 months — nicely done."}
        </InsightCard>
      ) : null}

      <ChartCard title="Snapshot" subtitle="This month">
        <View style={styles.statGrid}>
          <Stat label="Income" value={formatINR(totalIncome)} tone="income" />
          <Stat label="Expense" value={formatINR(totalExpenses)} tone="expense" />
          <Stat
            label="Net"
            value={formatINR(netCashFlow)}
            tone={netCashFlow < 0 ? "expense" : "income"}
          />
          <Stat
            label="Save rate"
            value={`${savingsRate > 0 ? savingsRate.toFixed(1) : 0}%`}
          />
        </View>
      </ChartCard>

      <SectionHeader title="Debt Health" />

      <DebtHealthGrid
        metrics={[
          { label: "Total Debt", value: formatINR(totalDebt), tone: "red" },
          {
            label: "Monthly Pay",
            value: formatINR(monthlyDebtPayments),
            tone: "dark",
          },
          {
            label: "Debt / Income",
            value: `${debtToIncomeRatio.toFixed(1)}%`,
            tone: debtToIncomeRatio > 40 ? "red" : "warn",
          },
          {
            label: "Debt-Free In",
            value: monthsToDebtFree > 0 ? `${monthsToDebtFree} mo` : "—",
            tone: "dark",
          },
        ]}
      />

      <SectionHeader title="Top Categories" />

      {topCategories.length === 0 ? (
        <Text
          style={[
            typography.captionRegular,
            {
              color: colors.textSecondary,
              textAlign: "center",
              marginHorizontal: 24,
              marginVertical: 24,
            },
          ]}
        >
          No expenses recorded this month.
        </Text>
      ) : (
        topCategories.map((c) => (
          <CategoryBreakdownRow
            key={c.category}
            name={c.label}
            color={CATEGORY_COLORS[mapCategoryKey(c.category)] || colors.accent}
            amount={c.amount}
            percent={c.percentage}
          />
        ))
      )}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  const { colors } = useTheme();
  const color =
    tone === "income"
      ? colors.accent
      : tone === "expense"
      ? colors.expense
      : colors.textPrimary;
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Text
        style={[typography.pillLabel, { color: colors.textTertiary }]}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color,
          marginTop: 4,
          letterSpacing: -0.16,
        }}
      >
        {value}
      </Text>
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
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
