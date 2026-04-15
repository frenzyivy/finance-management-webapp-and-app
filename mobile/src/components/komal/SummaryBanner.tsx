import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";
import { formatINR } from "./format";

interface SummaryBannerProps {
  label: string;
  value: number;
  tone?: "income" | "expense" | "neutral";
  emoji?: string;
}

export function SummaryBanner({
  label,
  value,
  tone = "neutral",
  emoji,
}: SummaryBannerProps) {
  const iconBg =
    tone === "income"
      ? "rgba(13,147,115,0.2)"
      : tone === "expense"
      ? "rgba(232,69,60,0.2)"
      : "rgba(255,255,255,0.1)";

  const icon = emoji ?? (tone === "expense" ? "💸" : tone === "income" ? "💰" : "📊");

  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatINR(value)}</Text>
      </View>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: radii.md,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  value: {
    fontFamily: fonts.sansBold,
    fontSize: 28,
    color: "#fff",
    letterSpacing: -0.56,
    marginTop: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
