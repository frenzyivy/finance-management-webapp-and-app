import React from "react";
import { formatAmount, formatINR } from "./format";

interface HeroBalanceCardProps {
  /** Net cash flow (income - expense). */
  netAmount: number;
  income: number;
  expense: number;
  label?: string;
}

/**
 * Dark hero balance card — KOMALFI_DESIGN_SYSTEM.md §3.3
 * Used on the Dashboard for the primary metric.
 */
export function HeroBalanceCard({
  netAmount,
  income,
  expense,
  label = "NET CASH FLOW",
}: HeroBalanceCardProps) {
  return (
    <div
      className="relative overflow-hidden mx-6 mb-5"
      style={{
        background: "#1A1A1A",
        color: "#fff",
        borderRadius: 24,
        padding: "28px 24px 24px",
        marginTop: 4,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          background: "rgba(13,147,115,0.15)",
          filter: "blur(40px)",
          borderRadius: "50%",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          bottom: -30,
          left: -30,
          width: 160,
          height: 160,
          background: "rgba(232,69,60,0.1)",
          filter: "blur(40px)",
          borderRadius: "50%",
        }}
      />

      <div className="relative" style={{ zIndex: 1 }}>
        <div
          className="font-medium"
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          className="flex items-baseline mt-3"
          style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {netAmount < 0 && (
            <span style={{ fontSize: 36, marginRight: 4 }}>−</span>
          )}
          <span style={{ fontSize: 22, opacity: 0.7, marginRight: 2 }}>₹</span>
          <span style={{ fontSize: 36 }}>{formatAmount(netAmount)}</span>
        </div>

        <div
          className="flex items-center mt-5 gap-4"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 16,
          }}
        >
          <MetricCell dotColor="#0D9373" label="Income" value={income} />
          <MetricCell dotColor="#E8453C" label="Expense" value={expense} />
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex-1 flex items-center gap-2">
      <span
        className="inline-block rounded-full"
        style={{ width: 8, height: 8, background: dotColor }}
      />
      <div className="flex flex-col">
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
          {formatINR(value)}
        </span>
      </div>
    </div>
  );
}
