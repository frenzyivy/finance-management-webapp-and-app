"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSyncStore } from "@/lib/stores/sync-store";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function useRelativeTime(date: Date | null) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!date) {
      setText("");
      return;
    }

    const update = () => {
      setText(formatDistanceToNow(date, { addSuffix: true }));
    };
    update();

    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [date]);

  return text;
}

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  disconnected: "bg-red-500",
};

export function SyncDropdownItem() {
  const { connectionStatus, lastSyncedAt, syncNow } = useSyncStore();
  const relativeTime = useRelativeTime(lastSyncedAt);

  const isStale =
    lastSyncedAt && Date.now() - lastSyncedAt.getTime() > 3_600_000;

  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer",
        isStale && "bg-amber-50 dark:bg-amber-950"
      )}
      onClick={(e) => {
        e.preventDefault();
        syncNow();
      }}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      <span className="flex-1">Sync Now</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            STATUS_DOT[connectionStatus]
          )}
        />
        {relativeTime || "Not synced"}
      </span>
    </DropdownMenuItem>
  );
}

export function SyncStatusIndicator() {
  const { connectionStatus, lastSyncedAt, syncNow } = useSyncStore();
  const relativeTime = useRelativeTime(lastSyncedAt);

  const isStale =
    lastSyncedAt && Date.now() - lastSyncedAt.getTime() > 3_600_000;

  return (
    <button
      onClick={syncNow}
      className={cn(
        "mt-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        isStale && "text-amber-600 dark:text-amber-400"
      )}
      title="Click to sync now"
    >
      <span
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full",
          STATUS_DOT[connectionStatus]
        )}
      />
      <span className="truncate">
        {relativeTime ? `Synced ${relativeTime}` : "Not synced"}
      </span>
      <RefreshCw className="ml-auto h-3 w-3 shrink-0" />
    </button>
  );
}
