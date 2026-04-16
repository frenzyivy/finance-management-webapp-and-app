import type { SavingsGoal, SavingsContribution } from "./database";

export type GoalColorRamp =
  | "pink"
  | "purple"
  | "teal"
  | "blue"
  | "amber"
  | "green"
  | "coral"
  | "gray"
  | "red";

export interface GoalCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string; // "lucide:Home" or "emoji:🎯"
  color: GoalColorRamp;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GoalV2 = SavingsGoal;

export interface GoalsBootstrap {
  categories: GoalCategory[];
  goals: GoalV2[];
  contributions: SavingsContribution[];
}

export type IconKind = "lucide" | "emoji";

export interface IconRef {
  kind: IconKind;
  value: string;
}

export function encodeIcon(ref: IconRef): string {
  return `${ref.kind}:${ref.value}`;
}

export function decodeIcon(stored: string | null | undefined): IconRef {
  if (!stored) return { kind: "lucide", value: "Target" };
  const idx = stored.indexOf(":");
  if (idx === -1) return { kind: "lucide", value: stored };
  const kind = stored.slice(0, idx);
  const value = stored.slice(idx + 1);
  if (kind === "emoji") return { kind: "emoji", value };
  return { kind: "lucide", value };
}

export interface ColorRampTokens {
  key: GoalColorRamp;
  label: string;
  bg: string;
  fill: string;
  text: string;
}

export const GOAL_COLOR_RAMPS: ColorRampTokens[] = [
  { key: "pink",   label: "Pink",   bg: "#FBEAF0", fill: "#D4537E", text: "#72243E" },
  { key: "purple", label: "Purple", bg: "#EEEDFE", fill: "#7F77DD", text: "#3C3489" },
  { key: "teal",   label: "Teal",   bg: "#E1F5EE", fill: "#1D9E75", text: "#085041" },
  { key: "blue",   label: "Blue",   bg: "#E6F1FB", fill: "#378ADD", text: "#0C447C" },
  { key: "amber",  label: "Amber",  bg: "#FAEEDA", fill: "#BA7517", text: "#633806" },
  { key: "green",  label: "Green",  bg: "#E4F3DF", fill: "#4A9B2F", text: "#1E4A10" },
  { key: "coral",  label: "Coral",  bg: "#FCE7E1", fill: "#D8604A", text: "#6E2617" },
  { key: "gray",   label: "Gray",   bg: "#ECEEF0", fill: "#6B7480", text: "#2A3038" },
  { key: "red",    label: "Red",    bg: "#FDE3E1", fill: "#D43C3C", text: "#6E1515" },
];

export const COLOR_RAMP_BY_KEY: Record<GoalColorRamp, ColorRampTokens> =
  GOAL_COLOR_RAMPS.reduce(
    (acc, ramp) => {
      acc[ramp.key] = ramp;
      return acc;
    },
    {} as Record<GoalColorRamp, ColorRampTokens>,
  );

export interface CreateCategoryInput {
  name: string;
  icon: string;
  color: GoalColorRamp;
  sort_order?: number;
}

export interface CreateGoalInput {
  name: string;
  target_amount: number;
  target_date: string | null;
  priority: "high" | "medium" | "low";
  category_id: string | null;
  notes: string | null;
  color: string | null;
  icon: string | null;
}

export interface AddContributionInput {
  goal_id: string;
  amount: number;
  date: string;
  source_description?: string | null;
  notes?: string | null;
}
