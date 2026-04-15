import React from "react";
import { CategoryIcon } from "./CategoryIcon";
import { formatINR } from "./format";

interface TransactionCardProps {
  name: string;
  kind: "income" | "expense" | "transfer";
  category?: string | null;
  categoryLabel?: string;
  /** Secondary meta tag — e.g. "Auto", "UPI", "EMI". */
  metaTag?: string;
  metaTagTone?: "default" | "muted" | "green";
  date?: string;
  method?: string;
  amount: number;
  emoji?: string;
  onClick?: () => void;
}

/**
 * List item used on every transactional screen (MD §3.8).
 * Amount styling: income → accent green, expense → text-primary (subtle, not red).
 */
export function TransactionCard({
  name,
  kind,
  category,
  categoryLabel,
  metaTag,
  metaTagTone = "default",
  date,
  method,
  amount,
  emoji,
  onClick,
}: TransactionCardProps) {
  const amountColor = kind === "income" ? "var(--accent)" : "var(--text-primary)";
  const amountPrefix = kind === "income" ? "+" : kind === "expense" ? "-" : "";

  const pillBg =
    metaTagTone === "green"
      ? "var(--accent-light)"
      : "var(--surface-alt)";
  const pillColor =
    metaTagTone === "green"
      ? "var(--accent)"
      : metaTagTone === "muted"
      ? "var(--text-tertiary)"
      : "var(--text-secondary)";

  const Tag: React.ElementType = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 transition-transform active:scale-[0.99] text-left"
      style={{
        padding: "14px 16px",
        background: "var(--surface)",
        borderRadius: 12,
        border: "1px solid var(--border-soft)",
      }}
    >
      <CategoryIcon kind={kind} category={category} emoji={emoji} />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {name}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryLabel ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 100,
                background: kind === "income" ? "var(--accent-light)" : "var(--surface-alt)",
                color: kind === "income" ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {categoryLabel}
            </span>
          ) : null}
          {metaTag ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 100,
                background: pillBg,
                color: pillColor,
              }}
            >
              {metaTag}
            </span>
          ) : null}
          {date ? (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {method ? `${date} · ${method}` : date}
            </span>
          ) : null}
        </div>
      </div>

      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: amountColor,
          whiteSpace: "nowrap",
        }}
      >
        {amountPrefix}
        {formatINR(Math.abs(amount))}
      </span>
    </Tag>
  );
}
