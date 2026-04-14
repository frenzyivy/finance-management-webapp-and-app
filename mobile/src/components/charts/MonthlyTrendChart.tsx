import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "../../lib/format";

interface MonthlyTrendChartProps {
  data: Array<{ month: string; income: number; expenses: number }>;
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);

  if (data.every((d) => d.income === 0 && d.expenses === 0)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No trend data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
          <Text style={styles.legendLabel}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#f87171" }]} />
          <Text style={styles.legendLabel}>Expenses</Text>
        </View>
      </View>

      {/* Bars */}
      <View style={styles.chart}>
        {data.map((item) => {
          const incomeH = (item.income / maxVal) * 100;
          const expenseH = (item.expenses / maxVal) * 100;
          return (
            <View key={item.month} style={styles.monthCol}>
              <View style={styles.barsRow}>
                <View style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(incomeH, 2)}%`,
                        backgroundColor: "#22c55e",
                      },
                    ]}
                  />
                </View>
                <View style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(expenseH, 2)}%`,
                        backgroundColor: "#f87171",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.monthLabel} numberOfLines={1}>
                {item.month.split(" ")[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: "#6b7280" },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 140,
    paddingBottom: 24,
  },
  monthCol: {
    flex: 1,
    alignItems: "center",
  },
  barsRow: {
    flexDirection: "row",
    gap: 4,
    height: 120,
    alignItems: "flex-end",
  },
  barColumn: {
    height: 120,
    justifyContent: "flex-end",
    width: 16,
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 2,
  },
  monthLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
});
