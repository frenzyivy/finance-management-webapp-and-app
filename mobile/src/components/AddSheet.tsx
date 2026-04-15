import React from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii } from "../lib/radii";

type QuickAdd = {
  key: string;
  emoji: string;
  bg: string;
  title: string;
  subtitle: string;
};

const QUICK_ADDS: QuickAdd[] = [
  { key: "AddIncome", emoji: "💰", bg: "#E8F5F0", title: "Add Income", subtitle: "Salary, freelance, other" },
  { key: "AddExpense", emoji: "💸", bg: "#FEF0EF", title: "Add Expense", subtitle: "Rent, food, shopping…" },
  { key: "AddGoal", emoji: "🐷", bg: "#FFF8E1", title: "Add Goal", subtitle: "Start a piggy bank" },
  { key: "AddDebt", emoji: "💳", bg: "#E3F2FD", title: "Add Debt", subtitle: "Loan, card, BNPL" },
  { key: "Imports", emoji: "📥", bg: "#EDE7F6", title: "Import", subtitle: "SMS, CSV, PDF statement" },
];

interface AddSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (key: string) => void;
}

export function AddSheet({ visible, onClose, onPick }: AddSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.bg,
            paddingBottom: 24 + insets.bottom,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.headerRow}>
          <Text style={[typography.pageTitle, { color: colors.textPrimary }]}>
            Quick Add
          </Text>
          <Pressable
            onPress={onClose}
            style={[
              styles.closeBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M6 6l12 12M6 18L18 6" />
            </Svg>
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={styles.list}
        >
          {QUICK_ADDS.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => {
                onClose();
                setTimeout(() => onPick(row.key), 120);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={[styles.emojiBox, { backgroundColor: row.bg }]}>
                <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {row.title}
                </Text>
                <Text
                  style={[
                    typography.pillLabelNoUpper,
                    { color: colors.textTertiary, marginTop: 2 },
                  ]}
                >
                  {row.subtitle}
                </Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="m9 6 6 6-6 6" />
              </Svg>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
  },
  handleWrap: {
    paddingTop: 12,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 100,
  },
  headerRow: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 6,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: 6,
  },
  emojiBox: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
