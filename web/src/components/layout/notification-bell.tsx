"use client";

import { Bell, IndianRupee, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePaymentReminders } from "@/hooks/use-payment-reminders";
import { formatCurrency } from "@/lib/utils/currency";
import type { UrgencyLevel } from "@/lib/utils/payment-reminders";

const URGENCY_STYLES: Record<
  UrgencyLevel,
  { bg: string; border: string; text: string; icon: typeof AlertCircle }
> = {
  overdue: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-l-red-500",
    text: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
  urgent: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-l-red-500",
    text: "text-red-600 dark:text-red-400",
    icon: AlertTriangle,
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-l-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    icon: Clock,
  },
  normal: {
    bg: "bg-muted/30",
    border: "border-l-muted-foreground/30",
    text: "text-muted-foreground",
    icon: IndianRupee,
  },
};

function getDueLabel(daysUntil: number): string {
  if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"}`;
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Due tomorrow";
  return `Due in ${daysUntil} days`;
}

export function NotificationBell() {
  const { reminders, reminderCount, loading } = usePaymentReminders();

  return (
    <Popover>
      <PopoverTrigger className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {reminderCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {reminderCount}
            </span>
          )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Payment Reminders</h3>
          <p className="text-xs text-muted-foreground">
            Upcoming EMI payments
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No upcoming payments
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {reminders.map((reminder) => {
                const style = URGENCY_STYLES[reminder.urgency];
                const Icon = style.icon;
                return (
                  <div
                    key={reminder.debtId}
                    className={`flex items-start gap-3 border-l-3 px-4 py-3 ${style.bg} ${style.border}`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {reminder.debtName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reminder.creditorName}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className={`text-xs font-semibold ${style.text}`}>
                          {getDueLabel(reminder.daysUntil)}
                        </span>
                        <span className="text-sm font-bold">
                          {formatCurrency(reminder.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(reminder.dueDate, "do MMM yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {reminders.length > 0 && (
          <div className="border-t px-4 py-2">
            <Link
              href="/debts"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all debts
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
