import React from "react";
import { formatINR } from "./format";

interface CategoryBreakdownRowProps {
  name: string;
  color: string;
  amount: number;
  /** 0–100 */
  percent: number;
}

export const CATEGORY_COLORS: Record<string, string> = {
  rent: "#42A5F5",
  food: "#FF9800",
  groceries: "#FF9800",
  utilities: "#7E57C2",
  shopping: "#FFC107",
  freelance: "#AB47BC",
  side_income: "#26C6DA",
  salary: "#0D9373",
  other: "#0D9373",
};

/**
 * One row of the category breakdown list (MD §3.12).
 */
export function CategoryBreakdownRow({
  name,
  color,
  amount,
  percent,
}: CategoryBreakdownRowProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="mx-6 mb-1.5 flex items-center gap-3"
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: "12px 16px",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div
        className="shrink-0"
        style={{
          width: 4,
          height: 32,
          borderRadius: 4,
          background: color,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          {name}
        </div>
        <div
          style={{
            height: 4,
            background: "var(--surface-alt)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: color,
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {formatINR(amount)}
      </div>
    </div>
  );
}
