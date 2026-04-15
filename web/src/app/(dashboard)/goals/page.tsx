"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useGoals } from "@/hooks/use-goals";
import { GoalForm } from "@/components/forms/goal-form";
import { ContributionForm } from "@/components/forms/contribution-form";
import { formatDate } from "@/lib/utils/date";
import type { SavingsGoal, SavingsContribution } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { PageHeader, HeaderIconButton } from "@/components/layout/PageHeader";
import {
  StatPillRow,
  SectionHeader,
  formatINR,
} from "@/components/komal";

function getPercentage(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

const PRIORITY_TONE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: "#FEF0EF", color: "#E8453C", label: "High" },
  medium: { bg: "#FFF8E1", color: "#F5A623", label: "Medium" },
  low: { bg: "#E8F5F0", color: "#0D9373", label: "Low" },
};

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsPageInner />
    </Suspense>
  );
}

function GoalsPageInner() {
  const searchParams = useSearchParams();
  const {
    goals,
    loading,
    fetchGoals,
    deleteGoal,
    fetchContributions,
    totalSaved,
    activeGoals,
    completedGoals,
  } = useGoals();

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>();
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailGoal, setDetailGoal] = useState<SavingsGoal | null>(null);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingGoal(undefined);
      setGoalDialogOpen(true);
    }
  }, [searchParams]);

  const openDetail = async (goal: SavingsGoal) => {
    setDetailGoal(goal);
    setLoadingContributions(true);
    const contribs = await fetchContributions(goal.id);
    setContributions(contribs);
    setLoadingContributions(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { error } = await deleteGoal(deleteTarget.id);
    if (error) toast.error("Failed to delete goal");
    else toast.success("Goal deleted");
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Savings Goals"
          actions={
            <HeaderIconButton
              aria-label="New goal"
              onClick={() => {
                setEditingGoal(undefined);
                setGoalDialogOpen(true);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </HeaderIconButton>
          }
        />
      </div>

      <div className="animate d2">
        <StatPillRow
          stats={[
            { label: "Total Saved", value: formatINR(totalSaved), tone: totalSaved === 0 ? "zero" : "default" },
            { label: "Active", value: `${activeGoals}` },
          ]}
        />
      </div>

      <div className="animate d3">
        <StatPillRow
          stats={[
            { label: "Completed", value: `${completedGoals}`, tone: completedGoals === 0 ? "zero" : "default" },
            { label: "Goals", value: `${goals.length}` },
          ]}
        />
      </div>

      <div className="animate d4">
        <SectionHeader title="Your Goals" />
      </div>

      {loading ? (
        <div className="mx-6 py-10 flex justify-center text-[var(--text-secondary)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="mx-6 py-10 text-center text-[var(--text-secondary)] text-sm">
          Start saving towards your dreams. Tap + to create your first goal.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-6">
          {goals.map((goal, idx) => {
            const pct = getPercentage(goal.current_balance, goal.target_amount);
            const color = goal.color || "#0D9373";
            const priority = PRIORITY_TONE[goal.priority] || PRIORITY_TONE.low;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => openDetail(goal)}
                className={`animate d${Math.min(idx + 5, 10)} mx-6 text-left transition-transform active:scale-[0.99]`}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="shrink-0"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: `${color}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {goal.icon || "🐷"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                        {goal.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 100,
                          background: priority.bg,
                          color: priority.color,
                        }}
                      >
                        {priority.label}
                      </span>
                      {goal.status !== "active" && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: 100,
                            background: "var(--surface-alt)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {goal.status}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {formatINR(goal.current_balance)} / {formatINR(goal.target_amount)} ({pct}%)
                      {goal.target_date ? ` · ${formatDate(goal.target_date)}` : ""}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--surface-alt)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: color,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  {goal.status === "active" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContributionGoal(goal);
                        setContributionDialogOpen(true);
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "6px 12px",
                        borderRadius: 100,
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                      }}
                    >
                      + Add Money
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGoal(goal);
                      setGoalDialogOpen(true);
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: 100,
                      background: "var(--surface-alt)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(goal);
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "6px 12px",
                      borderRadius: 100,
                      background: "var(--expense-light)",
                      color: "var(--expense)",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit Goal" : "Create New Goal"}</DialogTitle>
            <DialogDescription>
              {editingGoal ? "Update the details of this savings goal." : "Set up a new savings goal."}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            goal={editingGoal}
            onSuccess={() => {
              setGoalDialogOpen(false);
              setEditingGoal(undefined);
              fetchGoals();
            }}
            onCancel={() => {
              setGoalDialogOpen(false);
              setEditingGoal(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Money to {contributionGoal?.name ?? "Goal"}</DialogTitle>
            <DialogDescription>Record a new contribution towards this goal.</DialogDescription>
          </DialogHeader>
          {contributionGoal && (
            <ContributionForm
              goalId={contributionGoal.id}
              goalName={contributionGoal.name}
              onSuccess={() => {
                setContributionDialogOpen(false);
                setContributionGoal(null);
                fetchGoals();
              }}
              onCancel={() => {
                setContributionDialogOpen(false);
                setContributionGoal(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailGoal} onOpenChange={(open) => !open && setDetailGoal(null)}>
        <DialogContent className="sm:max-w-lg">
          {detailGoal && (
            <>
              <DialogHeader>
                <DialogTitle>{detailGoal.name}</DialogTitle>
                <DialogDescription>Goal details and contribution history</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <p className="text-sm">
                  <span className="font-semibold">{formatINR(detailGoal.current_balance)}</span> of{" "}
                  {formatINR(detailGoal.target_amount)} saved (
                  {getPercentage(detailGoal.current_balance, detailGoal.target_amount)}%)
                </p>
                <h4 className="text-sm font-semibold">Contributions</h4>
                {loadingContributions ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground mx-auto" />
                ) : contributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No contributions yet.
                  </p>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {contributions.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{formatINR(c.amount)}</p>
                          {c.source_description && (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {c.source_description}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)]">{formatDate(c.date)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? All contributions will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
