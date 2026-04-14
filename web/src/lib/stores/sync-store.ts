import { create } from "zustand";

interface SyncState {
  syncVersion: number;
  lastSyncedAt: Date | null;
  connectionStatus: "connected" | "connecting" | "disconnected";
  incrementSyncVersion: () => void;
  setLastSyncedAt: (date: Date) => void;
  setConnectionStatus: (status: SyncState["connectionStatus"]) => void;
  syncNow: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncVersion: 0,
  lastSyncedAt: null,
  connectionStatus: "disconnected",
  incrementSyncVersion: () =>
    set((state) => ({ syncVersion: state.syncVersion + 1 })),
  setLastSyncedAt: (date: Date) => set({ lastSyncedAt: date }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  syncNow: () =>
    set((state) => ({
      syncVersion: state.syncVersion + 1,
      lastSyncedAt: new Date(),
    })),
}));
