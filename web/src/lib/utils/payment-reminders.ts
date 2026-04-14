import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { Debt } from "@/types/database";

export type UrgencyLevel = "overdue" | "urgent" | "warning" | "normal";

export interface PaymentReminder {
  debtId: string;
  debtName: string;
  creditorName: string;
  amount: number;
  dueDate: Date;
  daysUntil: number;
  urgency: UrgencyLevel;
}

export function getUrgencyLevel(daysUntil: number): UrgencyLevel {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 2) return "urgent";
  if (daysUntil <= 5) return "warning";
  return "normal";
}

function getNextDueDate(emiDayOfMonth: number): Date {
  const today = startOfDay(new Date());
  const year = today.getFullYear();
  const month = today.getMonth();

  // Clamp to last day of current month
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(emiDayOfMonth, lastDayThisMonth);
  const thisMonthDate = new Date(year, month, clampedDay);

  if (thisMonthDate >= today) return thisMonthDate;

  // Clamp to last day of next month
  const lastDayNextMonth = new Date(year, month + 2, 0).getDate();
  const clampedNextDay = Math.min(emiDayOfMonth, lastDayNextMonth);
  return new Date(year, month + 1, clampedNextDay);
}

export function getPaymentReminders(
  debts: Debt[],
  reminderDays: number = 5
): PaymentReminder[] {
  const today = startOfDay(new Date());

  return debts
    .filter(
      (d) =>
        d.status === "active" &&
        d.emi_amount != null &&
        d.emi_amount > 0 &&
        d.emi_day_of_month != null
    )
    .map((d) => {
      const dueDate = getNextDueDate(d.emi_day_of_month!);
      const daysUntil = differenceInCalendarDays(dueDate, today);

      return {
        debtId: d.id,
        debtName: d.name,
        creditorName: d.creditor_name,
        amount: d.emi_amount!,
        dueDate,
        daysUntil,
        urgency: getUrgencyLevel(daysUntil),
      };
    })
    .filter((r) => r.daysUntil <= reminderDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
