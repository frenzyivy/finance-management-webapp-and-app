"use client";

import { formatINR } from "@/components/komal";
import { formatDate } from "@/lib/utils/date";
import type { GoalV2 } from "@/types/goals-v2";

function pct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((saved / target) * 100), 100);
}

const PRIORITY_TONE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: "#FEF0EF", color: "#E8453C", label: "High" },
  medium: { bg: "#FFF8E1", color: "#F5A623", label: "Medium" },
  low: { bg: "#E8F5F0", color: "#0D9373", label: "Low" },
};

interface GoalRowProps {
  goal: GoalV2;
  accentColor: string;
  onClick?: (goal: GoalV2) => void;
}

export function GoalRow({ goal, accentColor, onClick }: GoalRowProps) {
  const saved = Number(goal.current_balance) || 0;
  const target = Number(goal.target_amount) || 0;
  const percent = pct(saved, target);
  const priority = PRIORITY_TONE[goal.priority] ?? PRIORITY_TONE.low;

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(goal) : undefined}
      className="text-left w-full transition-transform active:scale-[0.99]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          {goal.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 100,
            background: priority.bg,
            color: priority.color,
          }}
        >
          {priority.label}
        </span>
        {goal.achieved_at && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 100,
              background: "#E8F5F0",
              color: "#0D9373",
            }}
          >
            Achieved
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
        {formatINR(saved)} / {formatINR(target)} ({percent}%)
        {goal.target_date ? ` · ${formatDate(goal.target_date)}` : ""}
      </div>

      <div
        style={{
          height: 6,
          background: "var(--surface-alt)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: accentColor,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </button>
  );
}
