import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface Stat {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "negative" | "zero";
}

export function StatPillRow({ stats }: { stats: Stat[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {stats.map((s, i) => {
        const valueColor =
          s.tone === "negative"
            ? colors.expense
            : s.tone === "zero"
            ? colors.textTertiary
            : colors.textPrimary;
        return (
          <View
            key={i}
            style={[
              styles.pill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.textTertiary }]}>
              {s.label.toUpperCase()}
            </Text>
            <Text style={[styles.value, { color: valueColor }]}>{s.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 28,
  },
  pill: {
    flex: 1,
    padding: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  value: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    marginTop: 6,
    letterSpacing: -0.36,
  },
});
