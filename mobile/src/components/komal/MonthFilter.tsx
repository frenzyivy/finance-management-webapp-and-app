import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { parseISO, format } from "date-fns";
import { useTheme } from "../../lib/theme-context";
import { fonts } from "../../lib/typography";
import { PickerModal } from "../PickerModal";

interface MonthFilterProps {
  value: string;
  onChange: (next: string) => void;
  months: string[];
}

const ALL = "all";
const VISIBLE_PILLS = 3;

function labelFor(value: string, style: "long" | "short" = "long"): string {
  if (value === ALL) return "All time";
  const d = parseISO(value + "-01");
  if (style === "short") {
    const year = d.getFullYear().toString().slice(-2);
    return `${format(d, "MMM")} ${year}`;
  }
  return format(d, "MMMM yyyy");
}

export function MonthFilter({ value, onChange, months }: MonthFilterProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  // Stable top-N in descending order. Selected overflow month is reflected
  // in the "More" pill label rather than being promoted.
  const pillMonths = useMemo(() => months.slice(0, VISIBLE_PILLS), [months]);
  const overflowForMenu = useMemo(() => months.slice(VISIBLE_PILLS), [months]);

  const moreActive = value === ALL || overflowForMenu.includes(value);
  const moreLabel = value === ALL
    ? "All time"
    : overflowForMenu.includes(value)
    ? labelFor(value, "short")
    : "More";

  const pickerOptions = [
    { value: ALL, label: "All time" },
    ...overflowForMenu.map((m) => ({ value: m, label: labelFor(m) })),
  ];

  const renderPill = (key: string, label: string, active: boolean, onPress: () => void, withChevron = false) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? colors.textPrimary : colors.surface,
          borderColor: active ? "transparent" : colors.border,
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
        numberOfLines={1}
      >
        {label}
      </Text>
      {withChevron ? (
        <Svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? colors.bg : colors.textSecondary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      ) : null}
    </Pressable>
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {pillMonths.map((m) =>
          renderPill(m, labelFor(m, "short"), m === value, () => onChange(m))
        )}
        {renderPill("__more__", moreLabel, moreActive, () => setOpen(true), true)}
      </ScrollView>

      <PickerModal
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={onChange}
        options={pickerOptions}
        selectedValue={value}
        title="Select month"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    gap: 6,
    marginBottom: 20,
    flexDirection: "row",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
  },
});
