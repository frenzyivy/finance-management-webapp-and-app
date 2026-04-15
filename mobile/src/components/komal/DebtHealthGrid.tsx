import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface Metric {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "red" | "warn" | "dark";
}

export function DebtHealthGrid({ metrics }: { metrics: Metric[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {metrics.map((m, i) => {
        const valueColor =
          m.tone === "red"
            ? colors.expense
            : m.tone === "warn"
            ? colors.warning
            : colors.textPrimary;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 11,
                letterSpacing: 0.66,
                color: colors.textTertiary,
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </Text>
            <Text
              style={{
                fontFamily: fonts.sansBold,
                fontSize: 20,
                color: valueColor,
                marginTop: 8,
                letterSpacing: -0.4,
              }}
            >
              {m.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  cell: {
    flexGrow: 1,
    flexBasis: "47%",
    padding: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
