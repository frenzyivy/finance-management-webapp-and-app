import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "../../lib/format";

const CHART_COLORS = [
  "#0d9488", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#22c55e", "#f97316", "#06b6d4", "#6366f1",
  "#d946ef", "#14b8a6", "#eab308",
];

interface ExpensePieChartProps {
  data: Array<{ label: string; amount: number; percentage: number }>;
}

export function ExpensePieChart({ data }: ExpensePieChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No expense data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stacked horizontal bar as a visual breakdown */}
      <View style={styles.barContainer}>
        {data.map((item, i) => (
          <View
            key={item.label}
            style={[
              styles.barSegment,
              {
                flex: item.percentage,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, i) => (
          <View key={item.label} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] },
              ]}
            />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.legendValue}>
              {formatCurrency(item.amount)} ({Math.round(item.percentage)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  barContainer: {
    flexDirection: "row",
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  barSegment: {
    minWidth: 4,
  },
  legend: { gap: 8 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: "#1f2937",
  },
  legendValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
});
