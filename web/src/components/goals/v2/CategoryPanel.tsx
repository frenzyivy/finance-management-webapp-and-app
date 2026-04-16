"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { formatINR } from "@/components/komal";
import {
  UNCATEGORIZED_ID,
  useGoalsStore,
  goalsByCategory,
  categoryStats,
} from "@/lib/stores/goals-store";
import {
  COLOR_RAMP_BY_KEY,
  type GoalCategory,
  type GoalV2,
} from "@/types/goals-v2";

import { GoalFormDialog } from "./GoalFormDialog";
import { GoalDetailDialog } from "./GoalDetailDialog";
import { GoalIcon } from "./GoalIcon";
import { GoalRow } from "./GoalRow";

const UNCATEGORIZED_CATEGORY: GoalCategory = {
  id: UNCATEGORIZED_ID,
  user_id: "",
  name: "Uncategorized",
  icon: "lucide:Target",
  color: "gray",
  is_default: false,
  sort_order: -1,
  created_at: "",
  updated_at: "",
};

export function CategoryPanel() {
  const openCategoryId = useGoalsStore((s) => s.openCategoryId);
  const closeCategory = useGoalsStore((s) => s.closeCategory);
  const categories = useGoalsStore((s) => s.categories);
  const allGoals = useGoalsStore((s) => s.goals);
  const category = useMemo(() => {
    if (!openCategoryId) return null;
    if (openCategoryId === UNCATEGORIZED_ID) return UNCATEGORIZED_CATEGORY;
    return categories.find((c) => c.id === openCategoryId) ?? null;
  }, [categories, openCategoryId]);
  const goals = useMemo(
    () => goalsByCategory(allGoals, openCategoryId),
    [allGoals, openCategoryId],
  );
  const stats = useMemo(
    () => categoryStats(allGoals, openCategoryId ?? "__none__"),
    [allGoals, openCategoryId],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalV2 | null>(null);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);

  const openCreateGoal = () => {
    setEditingGoal(null);
    setFormOpen(true);
  };
  const openEditGoal = (g: GoalV2) => {
    setDetailGoalId(null);
    setEditingGoal(g);
    setFormOpen(true);
  };
  const openDetail = (g: GoalV2) => setDetailGoalId(g.id);

  const isOpen = !!openCategoryId && !!category;

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCategory();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeCategory]);

  const ramp = category ? COLOR_RAMP_BY_KEY[category.color] : null;

  return (
    <>
    <AnimatePresence>
      {isOpen && category && ramp && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCategory}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)" }}
          />
          <motion.aside
            key="panel"
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 right-0 z-50 h-full flex flex-col"
            style={{
              width: 460,
              maxWidth: "92vw",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border-soft)",
              boxShadow: "-2px 0 24px rgba(0,0,0,0.08)",
            }}
          >
            <header
              className="flex items-center gap-3 px-5"
              style={{
                padding: "20px 20px 16px",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
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
                    fontSize: 16,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {category.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {formatINR(stats.totalSaved)} saved of{" "}
                  {formatINR(stats.totalTarget)}
                </div>
              </div>
              <button
                type="button"
                onClick={closeCategory}
                aria-label="Close panel"
                className="rounded-full p-1.5 transition-colors"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--surface-alt)",
                }}
              >
                <X size={16} />
              </button>
            </header>

            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "16px 20px 24px" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Goals ({goals.length})
                </span>
                <button
                  type="button"
                  onClick={openCreateGoal}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "6px 12px",
                    borderRadius: 100,
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  + Add goal
                </button>
              </div>

              {goals.length === 0 ? (
                <div
                  className="text-center py-10"
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                  }}
                >
                  No goals in this category yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {goals.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      accentColor={ramp.fill}
                      onClick={openDetail}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>

    <GoalFormDialog
      open={formOpen}
      onOpenChange={(next) => {
        setFormOpen(next);
        if (!next) setEditingGoal(null);
      }}
      goal={editingGoal}
      initialCategoryId={openCategoryId}
    />

    <GoalDetailDialog
      goalId={detailGoalId}
      onOpenChange={(next) => {
        if (!next) setDetailGoalId(null);
      }}
      onEdit={openEditGoal}
    />
    </>
  );
}
