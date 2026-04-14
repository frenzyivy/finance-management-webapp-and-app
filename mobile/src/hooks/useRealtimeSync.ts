import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useSyncStore } from "../lib/sync-store";

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

export function useRealtimeSync(userId: string | undefined) {
  const incrementSyncVersion = useSyncStore((s) => s.incrementSyncVersion);
  const setLastSyncedAt = useSyncStore((s) => s.setLastSyncedAt);
  const setConnectionStatus = useSyncStore((s) => s.setConnectionStatus);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`sync-${userId}`);

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
          filter: `user_id=eq.${userId}`,
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
        filter: `id=eq.${userId}`,
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
  }, [userId, incrementSyncVersion, setLastSyncedAt, setConnectionStatus]);
}
