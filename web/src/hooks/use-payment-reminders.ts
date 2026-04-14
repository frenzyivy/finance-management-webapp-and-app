"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDebts } from "@/hooks/use-debts";
import { getPaymentReminders } from "@/lib/utils/payment-reminders";
import type { PaymentReminder } from "@/lib/utils/payment-reminders";

const DEFAULT_REMINDER_DAYS = 5;

export function usePaymentReminders() {
  const { debts, loading: debtsLoading } = useDebts();
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPrefsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_preferences")
      .select("reminder_days_before, reminders_enabled")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setReminderDays(data.reminder_days_before);
      setRemindersEnabled(data.reminders_enabled);
    }
    setPrefsLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const reminders: PaymentReminder[] = useMemo(() => {
    if (!remindersEnabled) return [];
    return getPaymentReminders(debts, reminderDays);
  }, [debts, reminderDays, remindersEnabled]);

  const reminderCount = reminders.length;
  const loading = debtsLoading || prefsLoading;

  return {
    reminders,
    reminderCount,
    loading,
    reminderDays,
    remindersEnabled,
  };
}
