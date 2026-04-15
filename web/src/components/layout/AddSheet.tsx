"use client";

import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface AddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_ADDS: Array<{
  href: string;
  emoji: string;
  bg: string;
  title: string;
  subtitle: string;
}> = [
  { href: "/income?new=1", emoji: "💰", bg: "#E8F5F0", title: "Add Income", subtitle: "Salary, freelance, other" },
  { href: "/expenses?new=1", emoji: "💸", bg: "#FEF0EF", title: "Add Expense", subtitle: "Rent, food, shopping…" },
  { href: "/goals?new=1", emoji: "🐷", bg: "#FFF8E1", title: "Add Goal", subtitle: "Start a piggy bank" },
  { href: "/debts?new=1", emoji: "💳", bg: "#E3F2FD", title: "Add Debt", subtitle: "Loan, card, BNPL" },
  { href: "/imports", emoji: "📥", bg: "#EDE7F6", title: "Import", subtitle: "SMS, CSV, PDF statement" },
];

export function AddSheet({ open, onOpenChange }: AddSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="!bg-[var(--bg)] !text-[var(--text-primary)] max-h-[75vh] rounded-t-[24px] !p-0"
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
            Quick Add
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

        <div className="px-6 pt-2 pb-8 flex flex-col gap-1.5">
          {QUICK_ADDS.map((row) => (
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
                <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {row.subtitle}
                </span>
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
