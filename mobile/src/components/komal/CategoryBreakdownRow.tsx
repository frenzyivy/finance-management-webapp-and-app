import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";
import { formatINR } from "./format";

interface CategoryBreakdownRowProps {
  name: string;
  color: string;
  amount: number;
  percent: number;
}

export const CATEGORY_COLORS: Record<string, string> = {
  rent: "#42A5F5",
  food: "#FF9800",
  groceries: "#FF9800",
  utilities: "#7E57C2",
  shopping: "#FFC107",
  freelance: "#AB47BC",
  side_income: "#26C6DA",
  salary: "#0D9373",
  other: "#0D9373",
};

export function CategoryBreakdownRow({
  name,
  color,
  amount,
  percent,
}: CategoryBreakdownRowProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.strip, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 13,
            color: colors.textPrimary,
            marginBottom: 6,
          }}
        >
          {name}
        </Text>
        <View style={[styles.barBg, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: color,
              borderRadius: 4,
            }}
          />
        </View>
      </View>
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 14,
          color: colors.textPrimary,
        }}
      >
        {formatINR(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 6,
  },
  strip: {
    width: 4,
    height: 32,
    borderRadius: 4,
  },
  barBg: {
    height: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
});
