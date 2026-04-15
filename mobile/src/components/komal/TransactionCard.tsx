import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { CategoryIcon } from "./CategoryIcon";
import { formatINR } from "./format";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface TransactionCardProps {
  name: string;
  kind: "income" | "expense" | "transfer";
  category?: string | null;
  categoryLabel?: string;
  metaTag?: string;
  metaTagTone?: "default" | "muted" | "green";
  date?: string;
  method?: string;
  amount: number;
  emoji?: string;
  onPress?: () => void;
}

export function TransactionCard({
  name,
  kind,
  category,
  categoryLabel,
  metaTag,
  metaTagTone = "default",
  date,
  method,
  amount,
  emoji,
  onPress,
}: TransactionCardProps) {
  const { colors } = useTheme();

  const amountColor = kind === "income" ? colors.accent : colors.textPrimary;
  const amountPrefix = kind === "income" ? "+" : kind === "expense" ? "-" : "";

  const pillBg =
    metaTagTone === "green" ? colors.accentLight : colors.surfaceAlt;
  const pillColor =
    metaTagTone === "green"
      ? colors.accent
      : metaTagTone === "muted"
      ? colors.textTertiary
      : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <CategoryIcon kind={kind} category={category} emoji={emoji} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 14,
            color: colors.textPrimary,
          }}
        >
          {name}
        </Text>
        <View style={styles.metaRow}>
          {categoryLabel ? (
            <View
              style={[
                styles.pill,
                {
                  backgroundColor:
                    kind === "income" ? colors.accentLight : colors.surfaceAlt,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 11,
                  color: kind === "income" ? colors.accent : colors.textSecondary,
                }}
              >
                {categoryLabel}
              </Text>
            </View>
          ) : null}
          {metaTag ? (
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 11,
                  color: pillColor,
                }}
              >
                {metaTag}
              </Text>
            </View>
          ) : null}
          {date ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 11,
                color: colors.textTertiary,
              }}
            >
              {method ? `${date} · ${method}` : date}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 15,
          color: amountColor,
        }}
      >
        {amountPrefix}
        {formatINR(Math.abs(amount))}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
});
