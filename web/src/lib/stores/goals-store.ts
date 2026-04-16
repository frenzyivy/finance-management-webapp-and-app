import { create } from "zustand";

import type { SavingsContribution } from "@/types/database";
import type {
  GoalCategory,
  GoalV2,
  GoalsBootstrap,
} from "@/types/goals-v2";

interface GoalsState {
  categories: GoalCategory[];
  goals: GoalV2[];
  contributionsByGoal: Record<string, SavingsContribution[]>;
  openCategoryId: string | null;
  hydrated: boolean;

  hydrate: (bootstrap: GoalsBootstrap) => void;
  openCategory: (id: string) => void;
  closeCategory: () => void;
  upsertCategory: (cat: GoalCategory) => void;
  upsertGoal: (goal: GoalV2) => void;
  removeGoal: (goalId: string) => void;
  applyContribution: (contrib: SavingsContribution, updatedGoal?: GoalV2) => void;
}

function indexContributions(
  contributions: SavingsContribution[],
): Record<string, SavingsContribution[]> {
  const out: Record<string, SavingsContribution[]> = {};
  for (const c of contributions) {
    (out[c.goal_id] ??= []).push(c);
  }
  for (const gid in out) {
    out[gid].sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  return out;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  categories: [],
  goals: [],
  contributionsByGoal: {},
  openCategoryId: null,
  hydrated: false,

  hydrate: (bootstrap) =>
    set({
      categories: [...bootstrap.categories].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
      goals: bootstrap.goals,
      contributionsByGoal: indexContributions(bootstrap.contributions),
      hydrated: true,
    }),

  openCategory: (id) => set({ openCategoryId: id }),
  closeCategory: () => set({ openCategoryId: null }),

  upsertCategory: (cat) =>
    set((state) => {
      const next = state.categories.filter((c) => c.id !== cat.id);
      next.push(cat);
      next.sort((a, b) => a.sort_order - b.sort_order);
      return { categories: next };
    }),

  upsertGoal: (goal) =>
    set((state) => {
      const next = state.goals.filter((g) => g.id !== goal.id);
      next.push(goal);
      return { goals: next };
    }),

  removeGoal: (goalId) =>
    set((state) => {
      const nextContribs = { ...state.contributionsByGoal };
      delete nextContribs[goalId];
      return {
        goals: state.goals.filter((g) => g.id !== goalId),
        contributionsByGoal: nextContribs,
      };
    }),

  applyContribution: (contrib, updatedGoal) =>
    set((state) => {
      const existing = state.contributionsByGoal[contrib.goal_id] ?? [];
      const nextList = [contrib, ...existing.filter((c) => c.id !== contrib.id)];
      nextList.sort((a, b) => (a.date < b.date ? 1 : -1));
      const nextMap = {
        ...state.contributionsByGoal,
        [contrib.goal_id]: nextList,
      };
      const nextGoals = updatedGoal
        ? state.goals.map((g) => (g.id === updatedGoal.id ? updatedGoal : g))
        : state.goals;
      return { contributionsByGoal: nextMap, goals: nextGoals };
    }),
}));

// ── Pure helpers (call from components with useMemo, NOT from useStore(selector)) ──

export const UNCATEGORIZED_ID = "__uncategorized__";

export interface CategoryStats {
  totalSaved: number;
  totalTarget: number;
  activeCount: number;
  achievedCount: number;
}

function matchesCategory(g: GoalV2, categoryId: string): boolean {
  if (categoryId === UNCATEGORIZED_ID) return g.category_id === null;
  return g.category_id === categoryId;
}

export function goalsByCategory(
  goals: GoalV2[],
  categoryId: string | null,
): GoalV2[] {
  if (!categoryId) return [];
  return goals
    .filter((g) => matchesCategory(g, categoryId) && !g.archived_at)
    .sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return a.target_date < b.target_date ? -1 : 1;
    });
}

export function categoryStats(
  goals: GoalV2[],
  categoryId: string,
): CategoryStats {
  const result: CategoryStats = {
    totalSaved: 0,
    totalTarget: 0,
    activeCount: 0,
    achievedCount: 0,
  };
  for (const g of goals) {
    if (!matchesCategory(g, categoryId) || g.archived_at) continue;
    result.totalSaved += Number(g.current_balance) || 0;
    result.totalTarget += Number(g.target_amount) || 0;
    if (g.achieved_at) result.achievedCount += 1;
    else result.activeCount += 1;
  }
  return result;
}

export function hasUncategorizedGoals(goals: GoalV2[]): boolean {
  return goals.some((g) => g.category_id === null && !g.archived_at);
}

export function overallStats(goals: GoalV2[]): CategoryStats {
  const result: CategoryStats = {
    totalSaved: 0,
    totalTarget: 0,
    activeCount: 0,
    achievedCount: 0,
  };
  for (const g of goals) {
    if (g.archived_at) continue;
    result.totalSaved += Number(g.current_balance) || 0;
    result.totalTarget += Number(g.target_amount) || 0;
    if (g.achieved_at) result.achievedCount += 1;
    else result.activeCount += 1;
  }
  return result;
}
