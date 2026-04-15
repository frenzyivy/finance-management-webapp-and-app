"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MoreSheet } from "./MoreSheet";
import { AddSheet } from "./AddSheet";

type TabKey = "home" | "analytics" | "income" | "more";

const TABS: Array<{
  key: TabKey;
  label: string;
  href?: string;
  icon: (active: boolean) => React.ReactNode;
}> = [
  {
    key: "home",
    label: "Home",
    href: "/",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.08 : 0} />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </svg>
    ),
  },
  {
    key: "income",
    label: "Income",
    href: "/income",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V6M5 13l7-7 7 7" />
      </svg>
    ),
  },
  {
    key: "more",
    label: "More",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[100] lg:hidden"
        style={{
          height: `calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "color-mix(in srgb, var(--surface) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        <div className="relative h-[72px] flex items-center justify-around px-2">
          {/* Home */}
          <NavTabButton
            tab={TABS[0]}
            active={isActive(pathname, TABS[0].href)}
            onClick={() => router.push(TABS[0].href!)}
          />
          {/* Analytics */}
          <NavTabButton
            tab={TABS[1]}
            active={isActive(pathname, TABS[1].href)}
            onClick={() => router.push(TABS[1].href!)}
          />

          {/* Center FAB */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Add"
            className="flex flex-col items-center justify-center transition-transform active:scale-90"
            style={{ minWidth: 52 }}
          >
            <span
              className="flex items-center justify-center w-11 h-11 rounded-full"
              style={{
                background: "var(--accent)",
                boxShadow: "0 4px 16px rgba(13,147,115,0.3)",
                marginTop: -16,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>

          {/* Income */}
          <NavTabButton
            tab={TABS[2]}
            active={isActive(pathname, TABS[2].href)}
            onClick={() => router.push(TABS[2].href!)}
          />

          {/* More */}
          <NavTabButton
            tab={TABS[3]}
            active={moreOpen}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <AddSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function NavTabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 transition-transform active:scale-90"
      style={{
        minWidth: 52,
        color: active ? "var(--accent)" : "var(--text-tertiary)",
      }}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute -top-3 rounded-full"
          style={{ width: 24, height: 2.5, background: "var(--accent)" }}
        />
      ) : null}
      {tab.icon(active)}
      <span
        className="text-[10px] font-medium"
        style={{ letterSpacing: "0.01em" }}
      >
        {tab.label}
      </span>
    </button>
  );
}
