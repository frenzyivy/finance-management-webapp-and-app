"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useSyncStore } from "@/lib/stores/sync-store";

const SYNCED_TABLES = [
  "income_entries",
  "expense_entries",
  "savings_goals",
  "savings_contributions",
  "debts",
  "debt_payments",
  "budget_limits",
  "credit_cards",
  "business_income",
  "business_expenses",
  "business_subscriptions",
  "business_clients",
  "personal_business_transfers",
];

export function useRealtimeSync() {
  const { user } = useUser();
  const incrementSyncVersion = useSyncStore((s) => s.incrementSyncVersion);
  const setLastSyncedAt = useSyncStore((s) => s.setLastSyncedAt);
  const setConnectionStatus = useSyncStore((s) => s.setConnectionStatus);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel = supabase.channel(`sync-${user.id}`);

    const handleChange = () => {
      incrementSyncVersion();
      setLastSyncedAt(new Date());
    };

    for (const table of SYNCED_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${user.id}`,
        },
        handleChange
      );
    }

    // profiles uses 'id' not 'user_id'
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`,
      },
      handleChange
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
        setLastSyncedAt(new Date());
      } else if (status === "CLOSED") {
        setConnectionStatus("disconnected");
      } else {
        setConnectionStatus("connecting");
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, incrementSyncVersion, setLastSyncedAt, setConnectionStatus]);
}
