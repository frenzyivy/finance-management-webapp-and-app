import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface InsightCardProps {
  children: React.ReactNode;
  emoji?: string;
}

export function InsightCard({ children, emoji = "💡" }: InsightCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.accentLight,
          borderColor: "rgba(13,147,115,0.12)",
        },
      ]}
    >
      <Text style={{ fontSize: 18, marginRight: 12 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 13,
          color: colors.accent,
          lineHeight: 20,
          flex: 1,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 18,
    paddingVertical: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
