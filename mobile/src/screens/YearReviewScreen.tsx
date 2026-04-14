import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/constants";
import { formatCurrency } from "../lib/format";

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  const totalSaved = totalIncome - totalExpenses;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Year Selector */}
      <View style={styles.yearSelector}>
        <TouchableOpacity
          onPress={() => setSelectedYear((y) => y - 1)}
          style={styles.yearArrow}
        >
          <Text style={styles.yearArrowText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.yearLabel}>{selectedYear}</Text>
        <TouchableOpacity
          onPress={() => setSelectedYear((y) => y + 1)}
          style={styles.yearArrow}
        >
          <Text style={styles.yearArrowText}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {/* Annual Summary */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={[styles.summaryValue, { color: "#f87171" }]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Saved</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: totalSaved >= 0 ? "#22c55e" : "#f87171" },
            ]}
          >
            {formatCurrency(totalSaved)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Avg Monthly</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(totalExpenses / 12)}
          </Text>
        </View>
      </View>

      {/* Monthly Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>Month</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.5 }]}>Income</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.5 }]}>Expenses</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>Rate</Text>
        </View>
        {monthlyData.map((row) => (
          <View key={row.month} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1, fontWeight: "600" }]}>{row.month}</Text>
            <Text style={[styles.tableCell, { flex: 1.5, color: "#22c55e" }]}>
              {row.income > 0 ? formatCurrency(row.income) : "--"}
            </Text>
            <Text style={[styles.tableCell, { flex: 1.5, color: "#f87171" }]}>
              {row.expenses > 0 ? formatCurrency(row.expenses) : "--"}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { flex: 1, fontWeight: "600" },
                { color: row.savingsRate >= 0 ? "#22c55e" : "#f87171" },
              ]}
            >
              {row.income > 0 ? `${row.savingsRate.toFixed(0)}%` : "--"}
            </Text>
          </View>
        ))}
      </View>

      {/* Top Expense Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Spending Categories</Text>
        {topExpenseCategories.map((cat) => (
          <View key={cat.label} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
            </View>
            <View style={styles.catBarBg}>
              <View
                style={[styles.catBarFill, { width: `${cat.percentage}%`, backgroundColor: "#f87171" }]}
              />
            </View>
            <Text style={styles.catPct}>{cat.percentage.toFixed(1)}%</Text>
          </View>
        ))}
      </View>

      {/* Top Income Sources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Income Sources</Text>
        {topIncomeCategories.map((cat) => (
          <View key={cat.label} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
            </View>
            <View style={styles.catBarBg}>
              <View
                style={[styles.catBarFill, { width: `${cat.percentage}%`, backgroundColor: "#22c55e" }]}
              />
            </View>
            <Text style={styles.catPct}>{cat.percentage.toFixed(1)}%</Text>
          </View>
        ))}
      </View>

      {/* Key Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Insights</Text>
        {insights.map((ins, i) => (
          <View key={i} style={styles.insightRow}>
            <Text style={styles.insightNumber}>{i + 1}.</Text>
            <Text style={styles.insightText}>{ins}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  yearSelector: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    gap: 20,
  },
  yearArrow: {
    padding: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  yearArrowText: { fontSize: 20, fontWeight: "700", color: "#0d9488" },
  yearLabel: { fontSize: 24, fontWeight: "800", color: "#1f2937" },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  section: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 4,
  },
  tableHeaderText: { fontWeight: "700", fontSize: 12, color: "#6b7280" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableCell: { fontSize: 12, color: "#1f2937" },
  catRow: { marginBottom: 12 },
  catInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  catLabel: { fontSize: 14, color: "#1f2937", fontWeight: "500" },
  catAmount: { fontSize: 14, color: "#1f2937", fontWeight: "600" },
  catBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    marginBottom: 2,
  },
  catBarFill: {
    height: 8,
    borderRadius: 4,
  },
  catPct: { fontSize: 11, color: "#6b7280" },
  insightRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  insightNumber: { fontSize: 14, fontWeight: "700", color: "#0d9488" },
  insightText: { fontSize: 14, color: "#1f2937", flex: 1 },
});
