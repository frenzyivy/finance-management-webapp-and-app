"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { parseISO } from "date-fns";
import { formatMonth } from "@/lib/utils/date";

interface MonthFilterProps {
  value: string;
  onChange: (next: string) => void;
  months: string[];
}

const ALL = "all";
const VISIBLE_PILLS = 3;

function labelFor(value: string, style: "long" | "short" = "long"): string {
  if (value === ALL) return "All time";
  const d = parseISO(value + "-01");
  if (style === "short") {
    // e.g. "Apr 26" — compact for the pill row
    const year = d.getFullYear().toString().slice(-2);
    const month = d.toLocaleString("en-US", { month: "short" });
    return `${month} ${year}`;
  }
  return formatMonth(d);
}

export function MonthFilter({ value, onChange, months }: MonthFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Always show the first VISIBLE_PILLS months (descending) so order is stable.
  // The selected overflow month stays in the "More" dropdown; we just label
  // the More pill with its name so the user can still see what's active.
  const pillMonths = useMemo(() => months.slice(0, VISIBLE_PILLS), [months]);
  const overflowForMenu = useMemo(
    () => months.slice(VISIBLE_PILLS),
    [months]
  );

  const pillBase: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 100,
    fontSize: 13,
    fontWeight: 500,
  };

  const activePill: React.CSSProperties = {
    background: "var(--text-primary)",
    color: "var(--bg)",
    border: "1px solid transparent",
  };

  const inactivePill: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-soft)",
  };

  return (
    <div
      ref={rootRef}
      className="px-6 mb-5 flex gap-1.5 overflow-x-auto relative"
      style={{ scrollbarWidth: "none" }}
    >
      {pillMonths.map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className="transition-transform active:scale-[0.96] shrink-0"
            style={{ ...pillBase, ...(active ? activePill : inactivePill) }}
          >
            {labelFor(m, "short")}
          </button>
        );
      })}

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="transition-transform active:scale-[0.96] flex items-center gap-1"
          style={{
            ...pillBase,
            ...(value === ALL || overflowForMenu.includes(value)
              ? activePill
              : inactivePill),
          }}
        >
          <span>
            {value === ALL
              ? "All time"
              : overflowForMenu.includes(value)
              ? labelFor(value, "short")
              : "More"}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 120ms ease",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open ? (
          <div
            role="listbox"
            className="absolute right-0 mt-1 z-20 min-w-[180px] max-h-[280px] overflow-y-auto"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              padding: 4,
            }}
          >
            {[ALL, ...overflowForMenu].map((opt) => {
              const active = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className="w-full text-left transition-colors"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    background: active
                      ? "var(--surface-alt, rgba(0,0,0,0.04))"
                      : "transparent",
                  }}
                >
                  {labelFor(opt)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
