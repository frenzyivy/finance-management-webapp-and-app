"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SavingsGoal, SavingsContribution } from "@/types/database";

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function useGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Sort by priority (high first), then by name
      const sorted = [...data].sort((a, b) => {
        const priorityDiff =
          (PRIORITY_ORDER[a.priority] ?? 2) -
          (PRIORITY_ORDER[b.priority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;
        return a.name.localeCompare(b.name);
      });
      setGoals(sorted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const deleteGoal = async (id: string) => {
    const supabase = createClient();
    // Delete contributions first, then the goal
    await supabase.from("savings_contributions").delete().eq("goal_id", id);
    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id);
    if (!error) setGoals((prev) => prev.filter((g) => g.id !== id));
    return { error };
  };

  const addContribution = async (
    goalId: string,
    amount: number,
    date: string,
    sourceDescription?: string,
    notes?: string
  ) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated") };

    // Insert the contribution
    const { error: contribError } = await supabase
      .from("savings_contributions")
      .insert({
        user_id: user.id,
        goal_id: goalId,
        amount,
        date,
        source_description: sourceDescription || null,
        notes: notes || null,
      });

    if (contribError) return { error: contribError };

    // Find the goal to calculate new balance
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return { error: new Error("Goal not found") };

    const newBalance = goal.current_balance + amount;
    const updates: Partial<SavingsGoal> = {
      current_balance: newBalance,
    };

    // If new balance meets or exceeds target, mark as completed
    if (newBalance >= goal.target_amount) {
      updates.status = "completed";
    }

    const { error: updateError } = await supabase
      .from("savings_goals")
      .update(updates)
      .eq("id", goalId);

    if (updateError) return { error: updateError };

    // Refetch goals
    await fetchGoals();
    return { error: null };
  };

  const fetchContributions = async (
    goalId: string
  ): Promise<SavingsContribution[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("savings_contributions")
      .select("*")
      .eq("goal_id", goalId)
      .order("date", { ascending: false });

    if (error || !data) return [];
    return data;
  };

  // Summary stats
  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + g.current_balance, 0),
    [goals]
  );

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === "active").length,
    [goals]
  );

  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === "completed").length,
    [goals]
  );

  return {
    goals,
    loading,
    fetchGoals,
    deleteGoal,
    addContribution,
    fetchContributions,
    totalSaved,
    activeGoals,
    completedGoals,
  };
}
