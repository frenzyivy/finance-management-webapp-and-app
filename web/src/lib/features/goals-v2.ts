export const isGoalsV2Enabled = (): boolean =>
  process.env.NEXT_PUBLIC_GOALS_V2 === "true";
