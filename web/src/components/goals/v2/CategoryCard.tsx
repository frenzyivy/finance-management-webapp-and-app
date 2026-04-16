"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

import { formatINR } from "@/components/komal";
import { formatDate } from "@/lib/utils/date";
import {
  useGoalsStore,
  categoryStats,
  goalsByCategory,
} from "@/lib/stores/goals-store";
import { COLOR_RAMP_BY_KEY, type GoalCategory } from "@/types/goals-v2";

import { GoalIcon } from "./GoalIcon";

const PREVIEW_LIMIT = 3;

interface CategoryCardProps {
  category: GoalCategory;
  onClick: () => void;
}

export function CategoryCard({ category, onClick }: CategoryCardProps) {
  const goals = useGoalsStore((s) => s.goals);
  const stats = useMemo(() => categoryStats(goals, category.id), [goals, category.id]);
  const previewGoals = useMemo(
    () => goalsByCategory(goals, category.id).slice(0, PREVIEW_LIMIT),
    [goals, category.id],
  );
  const ramp = COLOR_RAMP_BY_KEY[category.color];
  const pct =
    stats.totalTarget > 0
      ? Math.min(Math.round((stats.totalSaved / stats.totalTarget) * 100), 100)
      : 0;
  const hiddenCount = Math.max(
    stats.activeCount + stats.achievedCount - previewGoals.length,
    0,
  );

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="text-left w-full"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: ramp.bg,
            color: ramp.fill,
          }}
        >
          <GoalIcon stored={category.icon} size="lg" color={ramp.fill} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {category.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            {stats.activeCount + stats.achievedCount} goal
            {stats.activeCount + stats.achievedCount === 1 ? "" : "s"}
            {stats.achievedCount > 0 ? ` · ${stats.achievedCount} done` : ""}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
        {formatINR(stats.totalSaved)} / {formatINR(stats.totalTarget)} ({pct}%)
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
            width: `${pct}%`,
            height: "100%",
            background: ramp.fill,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {previewGoals.length > 0 && (
        <div
          className="flex flex-col gap-1.5"
          style={{
            paddingTop: 4,
            borderTop: "1px solid var(--border-soft)",
          }}
        >
          {previewGoals.map((g) => {
            const gSaved = Number(g.current_balance) || 0;
            const gTarget = Number(g.target_amount) || 0;
            const gPct =
              gTarget > 0
                ? Math.min(Math.round((gSaved / gTarget) * 100), 100)
                : 0;
            return (
              <div key={g.id} className="flex flex-col gap-0.5">
                <div
                  className="flex items-baseline justify-between gap-2"
                  style={{ fontSize: 11 }}
                >
                  <span
                    className="truncate"
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {g.name}
                  </span>
                  <span
                    style={{ color: "var(--text-tertiary)" }}
                    className="shrink-0 tabular-nums"
                  >
                    {formatINR(gSaved)} / {formatINR(gTarget)}
                  </span>
                </div>
                <div
                  className="flex items-center justify-between"
                  style={{ fontSize: 10, color: "var(--text-tertiary)" }}
                >
                  <span>{gPct}%</span>
                  {g.target_date && <span>{formatDate(g.target_date)}</span>}
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              +{hiddenCount} more
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
