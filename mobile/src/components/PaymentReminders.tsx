import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { formatCurrency } from "../lib/format";
import { usePaymentReminders } from "../hooks/usePaymentReminders";
import type { Debt } from "../types/database";
import type { UrgencyLevel } from "../lib/payment-reminders";

interface PaymentRemindersProps {
  debts: Debt[];
  onLogPayment?: (debtId: string) => void;
}

const URGENCY_COLORS: Record<UrgencyLevel, { bg: string; border: string; text: string }> = {
  overdue: { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" },
  urgent: { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" },
  warning: { bg: "#fefce8", border: "#f59e0b", text: "#d97706" },
  normal: { bg: "#f9fafb", border: "#d1d5db", text: "#6b7280" },
};

function getDueLabel(daysUntil: number): string {
  if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"}`;
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Due tomorrow";
  return `Due in ${daysUntil} days`;
}

function formatDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

const COLLAPSED_COUNT = 3;

export function PaymentReminders({ debts, onLogPayment }: PaymentRemindersProps) {
  const { reminders, reminderCount } = usePaymentReminders(debts);
  const [expanded, setExpanded] = useState(false);

  if (reminderCount === 0) return null;

  const visibleReminders = expanded ? reminders : reminders.slice(0, COLLAPSED_COUNT);
  const hasMore = reminderCount > COLLAPSED_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Reminders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{reminderCount}</Text>
        </View>
      </View>

      {visibleReminders.map((reminder) => {
        const colors = URGENCY_COLORS[reminder.urgency];
        return (
          <View
            key={reminder.debtId}
            style={[
              styles.item,
              { backgroundColor: colors.bg, borderLeftColor: colors.border },
            ]}
          >
            <View style={styles.itemContent}>
              <View style={styles.itemTop}>
                <Text style={styles.debtName}>{reminder.debtName}</Text>
                <Text style={styles.amount}>{formatCurrency(reminder.amount)}</Text>
              </View>
              <Text style={styles.creditor}>{reminder.creditorName}</Text>
              <View style={styles.itemBottom}>
                <Text style={[styles.dueLabel, { color: colors.text }]}>
                  {getDueLabel(reminder.daysUntil)}
                </Text>
                <Text style={styles.dueDate}>{formatDate(reminder.dueDate)}</Text>
              </View>
              {onLogPayment && (
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => onLogPayment(reminder.debtId)}
                >
                  <Text style={styles.payButtonText}>Log Payment</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {hasMore && (
        <TouchableOpacity
          style={styles.showMore}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.showMoreText}>
            {expanded ? "Show less" : `Show all (${reminderCount})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  badge: {
    marginLeft: 8,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  item: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  itemContent: {
    flex: 1,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  debtName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  creditor: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  dueLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  dueDate: {
    fontSize: 11,
    color: "#9ca3af",
  },
  payButton: {
    marginTop: 8,
    backgroundColor: "#0d9488",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  payButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  showMore: {
    alignItems: "center",
    paddingVertical: 8,
  },
  showMoreText: {
    color: "#0d9488",
    fontSize: 13,
    fontWeight: "600",
  },
});
