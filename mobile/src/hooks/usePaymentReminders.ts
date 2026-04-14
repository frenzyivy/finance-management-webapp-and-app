import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { getPaymentReminders } from "../lib/payment-reminders";
import type { PaymentReminder } from "../lib/payment-reminders";
import type { Debt } from "../types/database";

const DEFAULT_REMINDER_DAYS = 5;

export function usePaymentReminders(debts: Debt[]) {
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const fetchPreferences = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notification_preferences")
      .select("reminder_days_before, reminders_enabled")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setReminderDays(data.reminder_days_before);
      setRemindersEnabled(data.reminders_enabled);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const reminders: PaymentReminder[] = useMemo(() => {
    if (!remindersEnabled) return [];
    return getPaymentReminders(debts, reminderDays);
  }, [debts, reminderDays, remindersEnabled]);

  const reminderCount = reminders.length;

  return { reminders, reminderCount, reminderDays };
}
