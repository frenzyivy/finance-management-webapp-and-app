import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/constants";
import { formatCurrency } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { PageHeader } from "../components/PageHeader";
import { formatINR } from "../components/komal";

interface MonthRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
}

interface CategoryTotal {
  label: string;
  amount: number;
  percentage: number;
}

export function YearReviewScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([]);
  const [topExpenseCategories, setTopExpenseCategories] = useState<CategoryTotal[]>([]);
  const [topIncomeCategories, setTopIncomeCategories] = useState<CategoryTotal[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const [incomeRes, expenseRes] = await Promise.all([
        supabase
          .from("income_entries")
          .select("*")
          .gte("date", yearStart)
          .lte("date", yearEnd),
        supabase
          .from("expense_entries")
          .select("*")
          .gte("date", yearStart)
          .lte("date", yearEnd),
      ]);

      const incomeData = incomeRes.data ?? [];
      const expenseData = expenseRes.data ?? [];

      const incTotal = incomeData.reduce((s, e) => s + e.amount, 0);
      const expTotal = expenseData.reduce((s, e) => s + e.amount, 0);
      setTotalIncome(incTotal);
      setTotalExpenses(expTotal);

      // Monthly breakdown
      const months: MonthRow[] = [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (let m = 0; m < 12; m++) {
        const mStr = String(m + 1).padStart(2, "0");
        const mStart = `${selectedYear}-${mStr}-01`;
        const mEnd = `${selectedYear}-${mStr}-31`;

        const inc = incomeData
          .filter((e) => e.date >= mStart && e.date <= mEnd)
          .reduce((s, e) => s + e.amount, 0);
        const exp = expenseData
          .filter((e) => e.date >= mStart && e.date <= mEnd)
          .reduce((s, e) => s + e.amount, 0);
        const net = inc - exp;

        months.push({
          month: monthNames[m],
          income: inc,
          expenses: exp,
          net,
          savingsRate: inc > 0 ? (net / inc) * 100 : 0,
        });
      }
      setMonthlyData(months);

      // Top expense categories
      const expCatMap: Record<string, number> = {};
      for (const e of expenseData) {
        expCatMap[e.category] = (expCatMap[e.category] ?? 0) + e.amount;
      }
      const topExp = Object.entries(expCatMap)
        .map(([cat, amount]) => ({
          label: EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat,
          amount,
          percentage: expTotal > 0 ? (amount / expTotal) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      setTopExpenseCategories(topExp);

      // Top income sources
      const incCatMap: Record<string, number> = {};
      for (const e of incomeData) {
        incCatMap[e.category] = (incCatMap[e.category] ?? 0) + e.amount;
      }
      const topInc = Object.entries(incCatMap)
        .map(([cat, amount]) => ({
          label: INCOME_CATEGORIES.find((c) => c.value === cat)?.label ?? cat,
          amount,
          percentage: incTotal > 0 ? (amount / incTotal) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      setTopIncomeCategories(topInc);

      // Generate insights
      const ins: string[] = [];
      const saved = incTotal - expTotal;
      if (incTotal > 0) {
        ins.push(`You earned ${formatCurrency(incTotal)} and spent ${formatCurrency(expTotal)} in ${selectedYear}.`);
        ins.push(`Your overall savings rate was ${((saved / incTotal) * 100).toFixed(1)}%.`);
      }
      const bestMonth = [...months].sort((a, b) => b.savingsRate - a.savingsRate)[0];
      const worstMonth = [...months].filter((m) => m.income > 0).sort((a, b) => a.savingsRate - b.savingsRate)[0];
      if (bestMonth && bestMonth.income > 0) {
        ins.push(`Best saving month: ${bestMonth.month} (${bestMonth.savingsRate.toFixed(1)}% savings rate).`);
      }
      if (worstMonth && worstMonth.income > 0) {
        ins.push(`Highest spending month: ${worstMonth.month} (${worstMonth.savingsRate.toFixed(1)}% savings rate).`);
      }
      if (topExp.length > 0) {
        ins.push(`Top spending category: ${topExp[0].label} at ${formatCurrency(topExp[0].amount)} (${topExp[0].percentage.toFixed(1)}%).`);
      }
      const avgMonthlySpend = expTotal / 12;
      ins.push(`Average monthly spending: ${formatCurrency(avgMonthlySpend)}.`);
      setInsights(ins);
    } catch (err) {
      console.error("Year review error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData, syncVersion]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const totalSaved = totalIncome - totalExpenses;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader
        title="Year in Review"
        eyebrow={String(selectedYear)}
        actions={
          <>
            <Pressable
              onPress={() => setSelectedYear((y) => y - 1)}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
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
                strokeLinejoin="round"
              >
                <Path d="m15 18-6-6 6-6" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => setSelectedYear((y) => y + 1)}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
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
                strokeLinejoin="round"
              >
                <Path d="m9 18 6-6-6-6" />
              </Svg>
            </Pressable>
          </>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
          paddingHorizontal: 24,
        }}
      >
        {/* Annual Summary */}
        <View style={styles.summaryGrid}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              TOTAL INCOME
            </Text>
            <Text style={[typography.statValue, { color: colors.income }]}>
              {formatINR(totalIncome)}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              TOTAL EXPENSES
            </Text>
            <Text style={[typography.statValue, { color: colors.expense }]}>
              {formatINR(totalExpenses)}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              TOTAL SAVED
            </Text>
            <Text
              style={[
                typography.statValue,
                { color: totalSaved >= 0 ? colors.income : colors.expense },
              ]}
            >
              {formatINR(totalSaved)}
            </Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, marginBottom: 4 },
              ]}
            >
              AVG MONTHLY
            </Text>
            <Text style={[typography.statValue, { color: colors.textPrimary }]}>
              {formatINR(totalExpenses / 12)}
            </Text>
          </View>
        </View>

        {/* Monthly Breakdown */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginBottom: 12 },
            ]}
          >
            Monthly Breakdown
          </Text>
          <View
            style={[
              styles.tableHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, flex: 1 },
              ]}
            >
              MONTH
            </Text>
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, flex: 1.5 },
              ]}
            >
              INCOME
            </Text>
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, flex: 1.5 },
              ]}
            >
              EXPENSES
            </Text>
            <Text
              style={[
                typography.pillLabel,
                { color: colors.textSecondary, flex: 1 },
              ]}
            >
              RATE
            </Text>
          </View>
          {monthlyData.map((row) => (
            <View
              key={row.month}
              style={[styles.tableRow, { borderBottomColor: colors.border }]}
            >
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.textPrimary, flex: 1, fontWeight: "600" },
                ]}
              >
                {row.month}
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.income, flex: 1.5 },
                ]}
              >
                {row.income > 0 ? formatINR(row.income) : "--"}
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  { color: colors.expense, flex: 1.5 },
                ]}
              >
                {row.expenses > 0 ? formatINR(row.expenses) : "--"}
              </Text>
              <Text
                style={[
                  typography.captionRegular,
                  {
                    flex: 1,
                    fontWeight: "600",
                    color:
                      row.savingsRate >= 0 ? colors.income : colors.expense,
                  },
                ]}
              >
                {row.income > 0 ? `${row.savingsRate.toFixed(0)}%` : "--"}
              </Text>
            </View>
          ))}
        </View>

        {/* Top Expense Categories */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginBottom: 12 },
            ]}
          >
            Top Spending Categories
          </Text>
          {topExpenseCategories.map((cat) => (
            <View key={cat.label} style={styles.catRow}>
              <View style={styles.catInfo}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textPrimary },
                  ]}
                >
                  {cat.label}
                </Text>
                <Text
                  style={[
                    typography.amount,
                    { color: colors.textPrimary },
                  ]}
                >
                  {formatINR(cat.amount)}
                </Text>
              </View>
              <View
                style={[styles.catBarBg, { backgroundColor: colors.surfaceAlt }]}
              >
                <View
                  style={[
                    styles.catBarFill,
                    {
                      width: `${cat.percentage}%`,
                      backgroundColor: colors.expense,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  typography.pillLabelNoUpper,
                  { color: colors.textSecondary },
                ]}
              >
                {cat.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Top Income Sources */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginBottom: 12 },
            ]}
          >
            Income Sources
          </Text>
          {topIncomeCategories.map((cat) => (
            <View key={cat.label} style={styles.catRow}>
              <View style={styles.catInfo}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textPrimary },
                  ]}
                >
                  {cat.label}
                </Text>
                <Text
                  style={[
                    typography.amount,
                    { color: colors.textPrimary },
                  ]}
                >
                  {formatINR(cat.amount)}
                </Text>
              </View>
              <View
                style={[styles.catBarBg, { backgroundColor: colors.surfaceAlt }]}
              >
                <View
                  style={[
                    styles.catBarFill,
                    {
                      width: `${cat.percentage}%`,
                      backgroundColor: colors.income,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  typography.pillLabelNoUpper,
                  { color: colors.textSecondary },
                ]}
              >
                {cat.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Key Insights */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              typography.sectionTitle,
              { color: colors.textPrimary, marginBottom: 12 },
            ]}
          >
            Key Insights
          </Text>
          {insights.map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <Text
                style={[
                  typography.body,
                  { color: colors.accent, fontWeight: "700" },
                ]}
              >
                {i + 1}.
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textPrimary, flex: 1 },
                ]}
              >
                {ins}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 14,
  },
  section: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  catRow: { marginBottom: 12 },
  catInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  catBarBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  catBarFill: {
    height: 8,
    borderRadius: 4,
  },
  insightRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
});
