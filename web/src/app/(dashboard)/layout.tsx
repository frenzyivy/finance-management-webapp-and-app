"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useRealtimeSync();

  return (
    <div
      className="min-h-[100dvh] w-full flex justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="relative w-full min-h-[100dvh] flex flex-col"
        style={{
          maxWidth: "var(--shell-max-width)",
          background: "var(--bg)",
          paddingBottom: "calc(var(--nav-height) + 24px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
