import React from "react";
import { formatINR } from "./format";

interface SummaryBannerProps {
  label: string;
  value: number;
  tone?: "income" | "expense" | "neutral";
  emoji?: string;
}

/**
 * Dark summary banner used on Income / Expense pages (MD §3.4).
 */
export function SummaryBanner({
  label,
  value,
  tone = "neutral",
  emoji,
}: SummaryBannerProps) {
  const iconBg =
    tone === "income"
      ? "rgba(13,147,115,0.2)"
      : tone === "expense"
      ? "rgba(232,69,60,0.2)"
      : "rgba(255,255,255,0.1)";

  const icon = emoji ?? (tone === "expense" ? "💸" : tone === "income" ? "💰" : "📊");

  return (
    <div
      className="mx-6 mb-5 flex items-center justify-between"
      style={{
        background: "#1A1A1A",
        color: "#fff",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div className="flex flex-col">
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          {label}
        </span>
        <span
          style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}
        >
          {formatINR(value)}
        </span>
      </div>
      <span
        className="flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: 100,
          background: iconBg,
          fontSize: 22,
        }}
      >
        {icon}
      </span>
    </div>
  );
}
