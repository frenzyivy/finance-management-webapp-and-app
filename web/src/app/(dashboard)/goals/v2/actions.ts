"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { SavingsContribution } from "@/types/database";
import type {
  GoalCategory,
  GoalV2,
  GoalsBootstrap,
} from "@/types/goals-v2";

const GOAL_COLORS = [
  "pink",
  "purple",
  "teal",
  "blue",
  "amber",
  "green",
  "coral",
  "gray",
  "red",
] as const;

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return { supabase, user: data.user };
}

export async function getGoalsBootstrap(): Promise<GoalsBootstrap> {
  const { supabase, user } = await requireUser();

  const { count: catCount, error: countErr } = await supabase
    .from("goal_categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countErr) throw new Error(countErr.message);

  if ((catCount ?? 0) === 0) {
    const { error: seedErr } = await supabase.rpc(
      "seed_default_goal_categories",
      { p_user_id: user.id },
    );
    if (seedErr) throw new Error(seedErr.message);
  }

  const [catsRes, goalsRes] = await Promise.all([
    supabase
      .from("goal_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
  ]);

  if (catsRes.error) throw new Error(catsRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);

  const goals = (goalsRes.data ?? []) as GoalV2[];
  const goalIds = goals.map((g) => g.id);

  let contributions: SavingsContribution[] = [];
  if (goalIds.length > 0) {
    const { data: contribData, error: contribErr } = await supabase
      .from("savings_contributions")
      .select("*")
      .eq("user_id", user.id)
      .in("goal_id", goalIds)
      .order("date", { ascending: false });
    if (contribErr) throw new Error(contribErr.message);
    contributions = (contribData ?? []) as SavingsContribution[];
  }

  return {
    categories: (catsRes.data ?? []) as GoalCategory[],
    goals,
    contributions,
  };
}

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(80),
  color: z.enum(GOAL_COLORS),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export async function createCategory(
  input: z.infer<typeof createCategorySchema>,
): Promise<GoalCategory> {
  const parsed = createCategorySchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("goal_categories")
    .insert({
      user_id: user.id,
      name: parsed.name,
      icon: parsed.icon,
      color: parsed.color,
      sort_order: parsed.sort_order ?? 100,
      is_default: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/goals/v2");
  return data as GoalCategory;
}

const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(100),
  target_amount: z.number().positive(),
  target_date: z.string().nullable(),
  priority: z.enum(["high", "medium", "low"]),
  category_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
});

export async function createGoal(
  input: z.infer<typeof createGoalSchema>,
): Promise<GoalV2> {
  const parsed = createGoalSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name: parsed.name,
      target_amount: parsed.target_amount,
      target_date: parsed.target_date,
      priority: parsed.priority,
      category_id: parsed.category_id,
      notes: parsed.notes,
      color: parsed.color,
      icon: parsed.icon,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/goals/v2");
  return data as GoalV2;
}

const updateGoalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  target_amount: z.number().positive().optional(),
  target_date: z.string().nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
});

export async function updateGoal(
  input: z.infer<typeof updateGoalSchema>,
): Promise<GoalV2> {
  const parsed = updateGoalSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { id, ...patch } = parsed;

  const { data, error } = await supabase
    .from("savings_goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/goals/v2");
  return data as GoalV2;
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/goals/v2");
}

const addContributionSchema = z.object({
  goal_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
  source_description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function addContribution(
  input: z.infer<typeof addContributionSchema>,
): Promise<{ contribution: SavingsContribution; goal: GoalV2 }> {
  const parsed = addContributionSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: contribData, error: contribErr } = await supabase
    .from("savings_contributions")
    .insert({
      goal_id: parsed.goal_id,
      user_id: user.id,
      amount: parsed.amount,
      date: parsed.date,
      source_description: parsed.source_description ?? null,
      notes: parsed.notes ?? null,
    })
    .select("*")
    .single();

  if (contribErr) throw new Error(contribErr.message);

  const { data: goalData, error: goalErr } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("id", parsed.goal_id)
    .single();

  if (goalErr) throw new Error(goalErr.message);

  revalidatePath("/goals/v2");
  return {
    contribution: contribData as SavingsContribution,
    goal: goalData as GoalV2,
  };
}
