"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader, HeaderIconButton } from "@/components/layout/PageHeader";
import {
  StatPillRow,
  SectionHeader,
  formatINR,
} from "@/components/komal";
import {
  useGoalsStore,
  overallStats,
} from "@/lib/stores/goals-store";
import type { GoalsBootstrap } from "@/types/goals-v2";

import { CategoriesGrid } from "./CategoriesGrid";
import { CategoryPanel } from "./CategoryPanel";
import { CreateCategoryDialog } from "./CreateCategoryDialog";

interface GoalsV2ShellProps {
  bootstrap: GoalsBootstrap;
}

export function GoalsV2Shell({ bootstrap }: GoalsV2ShellProps) {
  const hydrate = useGoalsStore((s) => s.hydrate);
  const hydrated = useGoalsStore((s) => s.hydrated);
  const goals = useGoalsStore((s) => s.goals);
  const stats = useMemo(() => overallStats(goals), [goals]);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    hydrate(bootstrap);
  }, [bootstrap, hydrate]);

  const overallPct =
    stats.totalTarget > 0
      ? Math.min(
          Math.round((stats.totalSaved / stats.totalTarget) * 100 * 10) / 10,
          100,
        )
      : 0;

  if (!hydrated) return null;

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Goals"
          actions={
            <HeaderIconButton
              aria-label="New category"
              onClick={() => setCreateOpen(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </HeaderIconButton>
          }
        />
      </div>

      <div className="animate d2">
        <StatPillRow
          stats={[
            {
              label: "Total Target",
              value: formatINR(stats.totalTarget),
              tone: stats.totalTarget === 0 ? "zero" : "default",
            },
            {
              label: "Total Saved",
              value: formatINR(stats.totalSaved),
              tone: stats.totalSaved === 0 ? "zero" : "default",
            },
          ]}
        />
      </div>

      <div className="animate d3">
        <StatPillRow
          stats={[
            {
              label: "Overall",
              value: `${overallPct}%`,
              tone: stats.totalTarget === 0 ? "zero" : "default",
            },
            {
              label: "Active",
              value:
                stats.achievedCount > 0
                  ? `${stats.activeCount} (${stats.achievedCount} done)`
                  : `${stats.activeCount}`,
              tone: stats.activeCount === 0 ? "zero" : "default",
            },
          ]}
        />
      </div>

      <div className="animate d4">
        <SectionHeader title="Categories" />
      </div>

      <div className="animate d5 mb-6">
        <CategoriesGrid onCreateCategory={() => setCreateOpen(true)} />
      </div>

      <CategoryPanel />

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
