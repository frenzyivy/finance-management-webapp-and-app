import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { formatCurrency } from "../../lib/format";

interface DailySpendingChartProps {
  data: Array<{ day: string; amount: number }>;
}

export function DailySpendingChart({ data }: DailySpendingChartProps) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  if (data.every((d) => d.amount === 0)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No spending data</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      <View style={styles.chart}>
        {data.map((item) => {
          const heightPct = (item.amount / maxAmount) * 100;
          return (
            <View key={item.day} style={styles.barWrapper}>
              <View style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(heightPct, 2)}%`,
                      backgroundColor: item.amount > 0 ? "#0d9488" : "#e5e7eb",
                    },
                  ]}
                />
              </View>
              <Text style={styles.dayLabel}>{item.day}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    paddingBottom: 20,
    gap: 4,
  },
  barWrapper: {
    alignItems: "center",
    width: 22,
  },
  barColumn: {
    height: 100,
    justifyContent: "flex-end",
    width: 14,
  },
  bar: {
    width: 14,
    borderRadius: 3,
    minHeight: 2,
  },
  dayLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
  },
});
