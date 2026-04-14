import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "../lib/format";
import type { Debt } from "../types/database";

interface EMICalendarProps {
  debts: Debt[];
}

interface UpcomingEMI {
  debtName: string;
  amount: number;
  dueDate: Date;
  daysUntil: number;
}

function getNextDueDate(emiDayOfMonth: number): Date | null {
  if (!emiDayOfMonth) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Clamp to last day of current month
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(emiDayOfMonth, lastDayThisMonth);
  const thisMonth = new Date(year, month, clampedDay);

  if (thisMonth >= now) return thisMonth;

  // Clamp to last day of next month
  const lastDayNextMonth = new Date(year, month + 2, 0).getDate();
  const clampedNextDay = Math.min(emiDayOfMonth, lastDayNextMonth);
  return new Date(year, month + 1, clampedNextDay);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((b.getTime() - a.getTime()) / msPerDay);
}

function getDueLabel(days: number): string {
  if (days <= 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function EMICalendar({ debts }: EMICalendarProps) {
  const activeDebts = debts.filter(
    (d) => d.status === "active" && d.emi_amount != null && d.emi_amount > 0 && d.emi_day_of_month != null
  );

  const upcoming: UpcomingEMI[] = activeDebts
    .map((d) => {
      const nextDue = getNextDueDate(d.emi_day_of_month!);
      if (!nextDue) return null;
      return {
        debtName: d.name,
        amount: d.emi_amount!,
        dueDate: nextDue,
        daysUntil: daysBetween(new Date(), nextDue),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.daysUntil - b!.daysUntil) as UpcomingEMI[];

  if (upcoming.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upcoming EMIs</Text>
      {upcoming.map((emi) => {
        const isUrgent = emi.daysUntil <= 3;
        return (
          <View
            key={emi.debtName}
            style={[styles.item, isUrgent && styles.itemUrgent]}
          >
            <View style={styles.itemLeft}>
              <Text style={styles.debtName}>{emi.debtName}</Text>
              <Text style={[styles.dueText, isUrgent && styles.dueTextUrgent]}>
                {getDueLabel(emi.daysUntil)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatCurrency(emi.amount)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 6,
  },
  itemUrgent: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  itemLeft: { flex: 1, marginRight: 8 },
  debtName: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  dueText: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  dueTextUrgent: { color: "#d97706", fontWeight: "600" },
  amount: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
});
