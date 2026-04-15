import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: Array<{ color: string; label: string }>;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, legend, children }: ChartCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 16,
              color: colors.textPrimary,
              letterSpacing: -0.16,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.textTertiary,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {legend && legend.length ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {legend.map((l, i) => (
              <View key={i} style={styles.legendItem}>
                <View
                  style={[styles.dot, { backgroundColor: l.color }]}
                />
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 16 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
