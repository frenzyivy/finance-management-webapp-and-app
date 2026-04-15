import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  /** Set to true to render the dashboard-style greeting + name layout. */
  greeting?: boolean;
}

export function PageHeader({ title, eyebrow, actions, greeting }: PageHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 16 },
      ]}
    >
      <View style={{ flexDirection: "column" }}>
        {eyebrow ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginBottom: 2 },
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={[
            greeting ? typography.greetingName : typography.pageTitle,
            { color: colors.textPrimary },
          ]}
        >
          {title}
        </Text>
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
