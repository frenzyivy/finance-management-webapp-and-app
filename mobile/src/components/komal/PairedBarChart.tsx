import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";

interface Pair {
  label: string;
  income: number;
  expense: number;
}

/**
 * Side-by-side paired bars — matches the "6-Month Trend" chart in MD §3.10.
 */
export function PairedBarChart({ data }: { data: Pair[] }) {
  const { colors } = useTheme();
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

  return (
    <View style={styles.row}>
      {data.map((d, i) => {
        const incomeH = Math.max(3, (d.income / max) * 100);
        const expenseH = Math.max(3, (d.expense / max) * 100);
        return (
          <View key={i} style={styles.col}>
            <View style={styles.pairWrap}>
              <View
                style={{
                  width: 14,
                  height: `${incomeH}%`,
                  backgroundColor: colors.accent,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  borderBottomLeftRadius: 1,
                  borderBottomRightRadius: 1,
                }}
              />
              <View style={{ width: 3 }} />
              <View
                style={{
                  width: 14,
                  height: `${expenseH}%`,
                  backgroundColor: colors.expense,
                  opacity: 0.7,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  borderBottomLeftRadius: 1,
                  borderBottomRightRadius: 1,
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
    gap: 8,
    height: 160,
    alignItems: "flex-end",
  },
  col: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  pairWrap: {
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
