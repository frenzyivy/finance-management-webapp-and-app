import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { text as typography, fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";
import { formatAmount, formatINR } from "./format";

interface HeroBalanceCardProps {
  netAmount: number;
  income: number;
  expense: number;
  label?: string;
}

export function HeroBalanceCard({
  netAmount,
  income,
  expense,
  label = "NET CASH FLOW",
}: HeroBalanceCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.amountRow}>
        {netAmount < 0 && <Text style={styles.sign}>−</Text>}
        <Text style={styles.symbol}>₹</Text>
        <Text style={styles.amount}>{formatAmount(netAmount)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.metricsRow}>
        <Metric dotColor="#0D9373" label="Income" value={income} />
        <Metric dotColor="#E8453C" label="Expense" value={expense} />
      </View>
    </View>
  );
}

function Metric({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View>
        <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.metricValue}>{formatINR(value)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: radii.lg,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: "hidden",
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.96,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 12,
  },
  sign: {
    fontFamily: fonts.sansBold,
    fontSize: 36,
    color: "#fff",
    letterSpacing: -0.72,
    lineHeight: 40,
    marginRight: 4,
  },
  symbol: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    color: "rgba(255,255,255,0.7)",
    marginRight: 2,
  },
  amount: {
    fontFamily: fonts.sansBold,
    fontSize: 36,
    color: "#fff",
    letterSpacing: -0.72,
    lineHeight: 40,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 20,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 16,
  },
  metric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.66,
  },
  metricValue: {
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
    color: "#fff",
    marginTop: 2,
  },
});
