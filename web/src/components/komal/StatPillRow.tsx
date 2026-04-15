import React from "react";

interface Stat {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "negative" | "zero";
}

interface StatPillRowProps {
  stats: Stat[];
}

/**
 * Row of 2 stat pills (MD §3.6).
 */
export function StatPillRow({ stats }: StatPillRowProps) {
  return (
    <div className="mx-6 mb-7 flex gap-[10px]">
      {stats.map((s, i) => {
        const color =
          s.tone === "negative"
            ? "var(--expense)"
            : s.tone === "zero"
            ? "var(--text-tertiary)"
            : "var(--text-primary)";
        return (
          <div
            key={i}
            className="flex-1"
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 16,
              border: "1px solid var(--border-soft)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                fontWeight: 500,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginTop: 6,
                color,
                letterSpacing: "-0.02em",
              }}
            >
              {s.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
