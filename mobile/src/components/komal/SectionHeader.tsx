import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";

interface SectionHeaderProps {
  title: string;
  linkLabel?: string;
  onLinkPress?: () => void;
  right?: React.ReactNode;
}

export function SectionHeader({
  title,
  linkLabel,
  onLinkPress,
  right,
}: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 17,
          letterSpacing: -0.17,
          color: colors.textPrimary,
        }}
      >
        {title}
      </Text>
      {right ? (
        right
      ) : linkLabel && onLinkPress ? (
        <Pressable onPress={onLinkPress}>
          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: 13,
              color: colors.accent,
            }}
          >
            {linkLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 14,
  },
});
