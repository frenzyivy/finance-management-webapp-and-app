import React from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { navHeight } from "../lib/radii";

type IconProps = { color: string };

const icons: Record<string, (p: IconProps) => React.ReactNode> = {
  Home: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  ),
  Analytics: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </Svg>
  ),
  Income: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20V6M5 13l7-7 7 7" />
    </Svg>
  ),
  More: ({ color }) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
      <Circle cx={5} cy={12} r={1.5} />
      <Circle cx={12} cy={12} r={1.5} />
      <Circle cx={19} cy={12} r={1.5} />
    </Svg>
  ),
};

type Props = Pick<BottomTabBarProps, "state" | "navigation"> & {
  onAddPress: () => void;
};

/**
 * Custom 5-slot bottom tab bar matching KOMALFI_DESIGN_SYSTEM.md §3.14:
 * Home | Analytics | [+ FAB] | Income | More
 */
export function BottomTabBar({ state, navigation, onAddPress }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const totalHeight = navHeight + insets.bottom;

  return (
    <View
      style={[
        styles.container,
        {
          height: totalHeight,
          paddingBottom: insets.bottom,
          borderTopColor: colors.border,
          backgroundColor:
            Platform.OS === "android"
              ? isDark
                ? "rgba(28,28,27,0.92)"
                : "rgba(255,255,255,0.88)"
              : "transparent",
        },
      ]}
    >
      {Platform.OS !== "android" ? (
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          if (route.name === "Add") {
            return (
              <Pressable
                key={route.key}
                style={({ pressed }) => [
                  styles.fabWrapper,
                  { transform: [{ scale: pressed ? 0.9 : 1 }] },
                ]}
                onPress={onAddPress}
                accessibilityRole="button"
                accessibilityLabel="Add"
              >
                <View style={[styles.fab, { backgroundColor: colors.accent }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
                    <Path d="M12 5v14M5 12h14" />
                  </Svg>
                </View>
              </Pressable>
            );
          }

          const isFocused = state.index === index;
          const iconFn = icons[route.name] || icons.More;
          const color = isFocused ? colors.accent : colors.textTertiary;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                { transform: [{ scale: pressed ? 0.9 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {isFocused ? (
                <View
                  style={[styles.activeBar, { backgroundColor: colors.accent }]}
                />
              ) : null}
              {iconFn({ color })}
              <Text
                style={[
                  typography.navLabel,
                  { color, marginTop: 4 },
                ]}
              >
                {route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 2.5,
    borderRadius: 2,
  },
  fabWrapper: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -16,
    shadowColor: "#0D9373",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
