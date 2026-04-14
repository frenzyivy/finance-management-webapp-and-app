import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAnalytics } from "../hooks/useAnalytics";
import { ExpensePieChart } from "../components/charts/ExpensePieChart";
import { DailySpendingChart } from "../components/charts/DailySpendingChart";
import { MonthlyTrendChart } from "../components/charts/MonthlyTrendChart";
import { formatCurrency } from "../lib/format";

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    expenseByCategory,
    topCategories,
    dailySpending,
    monthlyTrend,
    totalDebt,
    monthlyDebtPayments,
    debtToIncomeRatio,
    monthsToDebtFree,
    loading,
    selectedMonth,
    setSelectedMonth,
  } = useAnalytics();

  const goToPrevMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1)
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
          <Text style={styles.monthArrowText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthYear(selectedMonth)}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
          <Text style={styles.monthArrowText}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {/* Year in Review Button */}
      <TouchableOpacity
        style={styles.yearReviewBtn}
        onPress={() => navigation.navigate("YearReview")}
        activeOpacity={0.8}
      >
        <Text style={styles.yearReviewBtnText}>Year in Review</Text>
      </TouchableOpacity>

      {/* Summary Cards */}
      <View style={styles.cardGrid}>
        <View style={[styles.summaryCard, { borderLeftColor: "#22c55e" }]}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={[styles.cardValue, { color: "#22c55e" }]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#f87171" }]}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={[styles.cardValue, { color: "#f87171" }]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#3b82f6" }]}>
          <Text style={styles.cardLabel}>Net Cash Flow</Text>
          <Text
            style={[
              styles.cardValue,
              { color: netCashFlow >= 0 ? "#22c55e" : "#f87171" },
            ]}
          >
            {formatCurrency(netCashFlow)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#8b5cf6" }]}>
          <Text style={styles.cardLabel}>Savings Rate</Text>
          <Text style={[styles.cardValue, { color: "#8b5cf6" }]}>
            {savingsRate.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Expense Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expense Breakdown</Text>
        <ExpensePieChart data={topCategories} />
      </View>

      {/* Daily Spending */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Spending</Text>
        <DailySpendingChart data={dailySpending} />
      </View>

      {/* 6-Month Trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6-Month Trend</Text>
        <MonthlyTrendChart data={monthlyTrend} />
      </View>

      {/* Debt Health */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debt Health</Text>
        <View style={styles.debtGrid}>
          <View style={styles.debtCard}>
            <Text style={styles.debtLabel}>Total Debt</Text>
            <Text style={[styles.debtValue, { color: "#f87171" }]}>
              {formatCurrency(totalDebt)}
            </Text>
          </View>
          <View style={styles.debtCard}>
            <Text style={styles.debtLabel}>Monthly Payments</Text>
            <Text style={styles.debtValue}>
              {formatCurrency(monthlyDebtPayments)}
            </Text>
          </View>
          <View style={styles.debtCard}>
            <Text style={styles.debtLabel}>Debt-to-Income</Text>
            <Text
              style={[
                styles.debtValue,
                { color: debtToIncomeRatio > 40 ? "#f87171" : "#22c55e" },
              ]}
            >
              {debtToIncomeRatio.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.debtCard}>
            <Text style={styles.debtLabel}>Months to Debt-Free</Text>
            <Text style={styles.debtValue}>
              {monthsToDebtFree > 0 ? `${monthsToDebtFree} mo` : "--"}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    gap: 16,
  },
  monthArrow: {
    padding: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  monthArrowText: { fontSize: 18, fontWeight: "700", color: "#0d9488" },
  monthLabel: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  yearReviewBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  yearReviewBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardGrid: {
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
    borderLeftWidth: 4,
  },
  cardLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: "700" },
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
    marginBottom: 8,
  },
  debtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  debtCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
  },
  debtLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  debtValue: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
});
