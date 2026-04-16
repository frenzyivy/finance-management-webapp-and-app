"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import {
  UNCATEGORIZED_ID,
  hasUncategorizedGoals,
  useGoalsStore,
} from "@/lib/stores/goals-store";
import type { GoalCategory } from "@/types/goals-v2";

import { CategoryCard } from "./CategoryCard";

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

interface CategoriesGridProps {
  onCreateCategory: () => void;
}

export function CategoriesGrid({ onCreateCategory }: CategoriesGridProps) {
  const categories = useGoalsStore((s) => s.categories);
  const goals = useGoalsStore((s) => s.goals);
  const openCategory = useGoalsStore((s) => s.openCategory);

  const showUncategorized = useMemo(() => hasUncategorizedGoals(goals), [goals]);

  const displayCategories: GoalCategory[] = useMemo(
    () =>
      showUncategorized
        ? [UNCATEGORIZED_CATEGORY, ...categories]
        : categories,
    [categories, showUncategorized],
  );

  return (
    <div
      className="grid gap-3 mx-6"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      }}
    >
      {displayCategories.map((cat) => (
        <CategoryCard
          key={cat.id}
          category={cat}
          onClick={() => openCategory(cat.id)}
        />
      ))}
      <button
        type="button"
        onClick={onCreateCategory}
        className="flex items-center justify-center gap-2 text-sm"
        style={{
          background: "transparent",
          border: "1.5px dashed var(--border-soft)",
          borderRadius: 12,
          padding: 16,
          color: "var(--text-secondary)",
          minHeight: 140,
        }}
      >
        <Plus size={18} strokeWidth={1.8} />
        New category
      </button>
    </div>
  );
}
