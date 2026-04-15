import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";

interface MonthBar {
  label: string;
  value: number;
}

interface MonthlyBarChartProps {
  data: MonthBar[];
  /** Minimum bar height (px) for zero/low values so the chart still reads. */
  minHeight?: number;
}

/**
 * Simple vertical bar chart rendered with <View> — avoids pulling in Victory.
 * Matches the Monthly Activity chart spec in MD §3.10.
 */
export function MonthlyBarChart({ data, minHeight = 3 }: MonthlyBarChartProps) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.row}>
      {data.map((d, i) => {
        const active = d.value > 0;
        const h = active ? Math.max(minHeight, (d.value / max) * 100) : minHeight;
        return (
          <View key={i} style={styles.col}>
            <View style={styles.barWrap}>
              <View
                style={{
                  width: 20,
                  height: `${h}%`,
                  minHeight: minHeight,
                  backgroundColor: active ? colors.accent : colors.surfaceAlt,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  borderWidth: active ? 0 : 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 10,
                color: colors.textTertiary,
                marginTop: 4,
              }}
            >
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    height: 140,
    alignItems: "flex-end",
  },
  col: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  barWrap: {
    height: 120,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
