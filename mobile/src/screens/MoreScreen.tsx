import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../lib/theme-context";
import { text as typography } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";

type Row = {
  key: string;
  emoji: string;
  bg: string;
  title: string;
  subtitle?: string;
  screen?: string;
};

const ROWS: Row[] = [
  { key: "Expenses", emoji: "💸", bg: "#FEF0EF", title: "Expenses", subtitle: "Track money out", screen: "Expenses" },
  { key: "Goals", emoji: "🐷", bg: "#FFF8E1", title: "Savings Goals", subtitle: "Piggy banks", screen: "Goals" },
  { key: "Debts", emoji: "💳", bg: "#E3F2FD", title: "Debts", subtitle: "What you owe", screen: "Debts" },
  { key: "Budget", emoji: "🎯", bg: "#E8F5F0", title: "Budget", subtitle: "Monthly limits", screen: "Budget" },
  { key: "CreditCards", emoji: "💳", bg: "#EDE7F6", title: "Credit Cards", subtitle: "Linked cards", screen: "CreditCards" },
  { key: "Transfers", emoji: "🔁", bg: "#E0F7FA", title: "Transfers", subtitle: "Between accounts", screen: "Transfers" },
  { key: "Imports", emoji: "📥", bg: "#F3E5F5", title: "Imports", subtitle: "SMS, CSV, PDF", screen: "Imports" },
  { key: "SmsScan", emoji: "📱", bg: "#E8F5F0", title: "Scan SMS", subtitle: "Parse bank messages", screen: "SmsScan" },
  { key: "CCStatementUpload", emoji: "🧾", bg: "#FFF3E0", title: "CC Statement", subtitle: "Upload PDF", screen: "CCStatementUpload" },
  { key: "ScanBnplInvoice", emoji: "📄", bg: "#EDE7F6", title: "Scan BNPL Invoice", subtitle: "OCR an invoice", screen: "ScanBnplInvoice" },
  { key: "YearReview", emoji: "📈", bg: "#F3E5F5", title: "Year Review", subtitle: "12-month snapshot", screen: "YearReview" },
  { key: "Business", emoji: "💼", bg: "#E0F7FA", title: "Allianza Biz", subtitle: "Business accounting", screen: "Business" },
  { key: "BusinessIncome", emoji: "💰", bg: "#E8F5F0", title: "Business Income", screen: "BusinessIncome" },
  { key: "BusinessExpenses", emoji: "💸", bg: "#FEF0EF", title: "Business Expenses", screen: "BusinessExpenses" },
  { key: "BusinessSubscriptions", emoji: "🔁", bg: "#EDE7F6", title: "Subscriptions", screen: "BusinessSubscriptions" },
  { key: "BusinessClients", emoji: "🤝", bg: "#FFF3E0", title: "Clients", screen: "BusinessClients" },
  { key: "Settings", emoji: "⚙️", bg: "#F0EFEB", title: "Settings", subtitle: "Preferences & account", screen: "Settings" },
];

type NavProp = NativeStackNavigationProp<Record<string, object | undefined>>;

export function MoreScreen({
  navigation,
}: {
  navigation: NavProp;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[typography.pageTitle, { color: colors.textPrimary }]}>
          More
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: navHeight + 24 + insets.bottom,
          gap: 6,
        }}
      >
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            onPress={() => {
              if (row.screen) {
                navigation.navigate(row.screen as never);
              }
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
              {row.subtitle ? (
                <Text
                  style={[
                    typography.pillLabelNoUpper,
                    { color: colors.textTertiary, marginTop: 2 },
                  ]}
                >
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m9 6 6 6-6 6" />
            </Svg>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
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
