import React from "react";

interface Metric {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "red" | "warn" | "dark";
}

interface DebtHealthGridProps {
  metrics: Metric[];
}

/**
 * 2-column grid of debt health metrics (MD §3.11).
 */
export function DebtHealthGrid({ metrics }: DebtHealthGridProps) {
  return (
    <div
      className="mx-6 mb-6"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      {metrics.map((m, i) => {
        const color =
          m.tone === "red"
            ? "var(--expense)"
            : m.tone === "warn"
            ? "var(--warning)"
            : "var(--text-primary)";
        return (
          <div
            key={i}
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
              {m.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginTop: 8,
                color,
                letterSpacing: "-0.02em",
              }}
            >
              {m.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
