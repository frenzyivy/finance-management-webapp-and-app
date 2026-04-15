import React from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";

interface TabSwitcherProps<T extends string> {
  tabs: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

export function TabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
}: TabSwitcherProps<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: active ? colors.textPrimary : colors.surface,
                borderColor: active ? "transparent" : colors.border,
                borderWidth: 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 13,
                color: active ? colors.bg : colors.textSecondary,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    gap: 6,
    marginBottom: 20,
    flexDirection: "row",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
});
