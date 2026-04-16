import { redirect } from "next/navigation";

import { isGoalsV2Enabled } from "@/lib/features/goals-v2";

import { getGoalsBootstrap } from "./actions";
import { GoalsV2Shell } from "@/components/goals/v2/GoalsV2Shell";

export default async function GoalsV2Page() {
  if (!isGoalsV2Enabled()) redirect("/goals");

  const bootstrap = await getGoalsBootstrap();

  return <GoalsV2Shell bootstrap={bootstrap} />;
}
