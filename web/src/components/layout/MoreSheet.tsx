"use client";

import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROWS: Array<{
  href: string;
  emoji: string;
  bg: string;
  title: string;
  subtitle?: string;
}> = [
  { href: "/expenses", emoji: "💸", bg: "#FEF0EF", title: "Expenses", subtitle: "Track money out" },
  { href: "/goals", emoji: "🐷", bg: "#FFF8E1", title: "Savings Goals", subtitle: "Piggy banks" },
  { href: "/debts", emoji: "💳", bg: "#E3F2FD", title: "Debts", subtitle: "What you owe" },
  { href: "/debts/invoices", emoji: "🧾", bg: "#EDE7F6", title: "BNPL Invoices", subtitle: "Buy-now-pay-later" },
  { href: "/imports", emoji: "📥", bg: "#E8F5F0", title: "Imports", subtitle: "SMS, CSV, PDF" },
  { href: "/analytics/year-review", emoji: "📈", bg: "#F3E5F5", title: "Year Review", subtitle: "12-month snapshot" },
  { href: "/business", emoji: "💼", bg: "#E0F7FA", title: "Allianza Biz", subtitle: "Business accounting" },
  { href: "/business/clients", emoji: "🤝", bg: "#FFF3E0", title: "Clients", subtitle: "Business clients" },
  { href: "/business/subscriptions", emoji: "🔁", bg: "#EDE7F6", title: "Subscriptions", subtitle: "Recurring biz income" },
  { href: "/settings", emoji: "⚙️", bg: "#F0EFEB", title: "Settings", subtitle: "Preferences & account" },
];

export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="!bg-[var(--bg)] !text-[var(--text-primary)] max-h-[85vh] rounded-t-[24px] !p-0"
        showCloseButton={false}
      >
        <div className="pt-4 pb-2 flex flex-col items-center">
          <span className="h-1 w-10 rounded-full bg-[var(--border-soft)]" />
        </div>
        <div className="px-6 pb-2 flex items-center justify-between">
          <SheetTitle
            className="font-[family-name:var(--font-instrument-serif)] text-[28px] leading-none text-[var(--text-primary)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            More
          </SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border-soft)] flex items-center justify-center active:scale-[0.94]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 pt-2 pb-8 flex flex-col gap-1.5">
          {ROWS.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3.5 p-3.5 rounded-[12px] bg-[var(--surface)] border border-[var(--border-soft)] transition-transform active:scale-[0.99]"
            >
              <span
                className="flex items-center justify-center w-[42px] h-[42px] rounded-[12px] text-lg"
                style={{ background: row.bg }}
              >
                {row.emoji}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-medium text-[var(--text-primary)]">
                  {row.title}
                </span>
                {row.subtitle ? (
                  <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {row.subtitle}
                  </span>
                ) : null}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
