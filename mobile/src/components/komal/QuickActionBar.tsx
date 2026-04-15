import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { radii } from "../../lib/radii";

interface Action {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
}

export function QuickActionBar({ actions }: { actions: Action[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {actions.map((a, i) => (
        <Pressable
          key={i}
          onPress={a.onPress}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {a.icon}
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 13,
                color: colors.textPrimary,
              }}
            >
              {a.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
