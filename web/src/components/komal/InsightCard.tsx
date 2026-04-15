import React from "react";

interface InsightCardProps {
  children: React.ReactNode;
  emoji?: string;
}

/**
 * Tip / insight card — accent-tinted (MD §3.13).
 */
export function InsightCard({ children, emoji = "💡" }: InsightCardProps) {
  return (
    <div
      className="mx-6 mb-5 flex items-start gap-3"
      style={{
        background: "var(--accent-light)",
        border: "1px solid rgba(13,147,115,0.12)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--accent)",
          lineHeight: 1.5,
        }}
      >
        {children}
      </span>
    </div>
  );
}
