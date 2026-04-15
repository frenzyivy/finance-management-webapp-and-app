"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useRealtimeSync();

  return (
    <div
      className="min-h-[100dvh] w-full flex"
      style={{ background: "var(--bg)" }}
    >
      <DesktopSidebar />

      <div
        className="relative flex-1 min-h-[100dvh] flex flex-col bg-[var(--bg)] pb-[calc(var(--nav-height)+24px+env(safe-area-inset-bottom,0px))]"
      >
        <main className="flex-1 flex flex-col w-full mx-auto max-w-[430px] lg:max-w-[1200px] lg:px-8 lg:py-6">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}