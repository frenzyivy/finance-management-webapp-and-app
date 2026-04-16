import { redirect } from "next/navigation";

import { isGoalsV2Enabled } from "@/lib/features/goals-v2";

import GoalsV1Client from "./GoalsV1Client";

export default function GoalsPage() {
  if (isGoalsV2Enabled()) redirect("/goals/v2");
  return <GoalsV1Client />;
}
