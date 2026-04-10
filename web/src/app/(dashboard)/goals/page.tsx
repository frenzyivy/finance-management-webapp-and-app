"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  PiggyBank,
  Target,
  Trophy,
  Coins,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { useGoals } from "@/hooks/use-goals";
import { GoalForm } from "@/components/forms/goal-form";
import { ContributionForm } from "@/components/forms/contribution-form";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { SavingsGoal, SavingsContribution } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// ── Helpers ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_STYLES: Record<string, string> = {
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  paused:
    "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
};

function getPercentage(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

// ── Page component ─────────────────────────────────────────────────────

export default function GoalsPage() {
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

  // Dialog states
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>();
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail dialog
  const [detailGoal, setDetailGoal] = useState<SavingsGoal | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);

  // ── Goal form handlers ───────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingGoal(undefined);
    setGoalDialogOpen(true);
  };

  const openEditDialog = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalDialogOpen(true);
  };

  const handleGoalFormSuccess = () => {
    setGoalDialogOpen(false);
    setEditingGoal(undefined);
    fetchGoals();
  };

  const handleGoalFormCancel = () => {
    setGoalDialogOpen(false);
    setEditingGoal(undefined);
  };

  // ── Contribution handlers ────────────────────────────────────────────

  const openContributionDialog = (goal: SavingsGoal) => {
    setContributionGoal(goal);
    setContributionDialogOpen(true);
  };

  const handleContributionSuccess = () => {
    setContributionDialogOpen(false);
    setContributionGoal(null);
    fetchGoals();
  };

  const handleContributionCancel = () => {
    setContributionDialogOpen(false);
    setContributionGoal(null);
  };

  // ── Delete handlers ──────────────────────────────────────────────────

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    const { error } = await deleteGoal(deletingId);
    if (error) {
      toast.error("Failed to delete goal");
    } else {
      toast.success("Goal deleted");
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  // ── Detail dialog handler ───────────────────────────────────────────

  const openDetailDialog = async (goal: SavingsGoal) => {
    setDetailGoal(goal);
    setDetailDialogOpen(true);
    setLoadingContributions(true);
    const contribs = await fetchContributions(goal.id);
    setContributions(contribs);
    setLoadingContributions(false);
  };

  // Recalculate projection for a goal based on contributions
  const [projections, setProjections] = useState<Record<string, string>>({});

  useEffect(() => {
    const calculateProjections = async () => {
      const newProjections: Record<string, string> = {};

      for (const goal of goals) {
        if (goal.status === "completed" || goal.current_balance <= 0) {
          continue;
        }

        const contribs = await fetchContributions(goal.id);
        if (contribs.length < 2) {
          newProjections[goal.id] = "";
          continue;
        }

        // Calculate average monthly contribution
        const dates = contribs.map((c) => new Date(c.date).getTime());
        const earliest = Math.min(...dates);
        const latest = Math.max(...dates);
        const monthsSpan = Math.max(
          (latest - earliest) / (1000 * 60 * 60 * 24 * 30),
          1
        );
        const totalContributed = contribs.reduce((s, c) => s + c.amount, 0);
        const monthlyAvg = totalContributed / monthsSpan;

        if (monthlyAvg <= 0) continue;

        const remaining = goal.target_amount - goal.current_balance;
        const monthsLeft = Math.ceil(remaining / monthlyAvg);

        if (monthsLeft <= 0) {
          newProjections[goal.id] = "Almost there!";
        } else if (monthsLeft === 1) {
          newProjections[goal.id] = "About 1 month away";
        } else {
          newProjections[goal.id] = `About ${monthsLeft} months away`;
        }
      }

      setProjections(newProjections);
    };

    if (goals.length > 0) {
      calculateProjections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="size-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Savings Goals</h2>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" data-icon="inline-start" />
          New Goal
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Saved
              </CardTitle>
              <Coins className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Goals
              </CardTitle>
              <Target className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeGoals}</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Goals
              </CardTitle>
              <Trophy className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{completedGoals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid or Empty State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16">
          <PiggyBank className="size-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">
              Start saving towards your dreams
            </p>
            <p className="text-sm text-muted-foreground">
              Create your first savings goal and watch your money grow.
            </p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="size-4" data-icon="inline-start" />
            Create Your First Goal
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const pct = getPercentage(goal.current_balance, goal.target_amount);
            const goalColor = goal.color || "#0d9488";
            const projection = projections[goal.id];

            return (
              <Card
                key={goal.id}
                className="relative overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openDetailDialog(goal)}
              >
                {/* Color bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: goalColor }}
                />

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {goal.name}
                    </CardTitle>
                    <div className="flex shrink-0 gap-1">
                      <Badge
                        variant="secondary"
                        className={PRIORITY_STYLES[goal.priority]}
                      >
                        {goal.priority}
                      </Badge>
                      {goal.status !== "active" && (
                        <Badge
                          variant="secondary"
                          className={STATUS_STYLES[goal.status]}
                        >
                          {goal.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-3 pb-4">
                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: goalColor,
                      }}
                    />
                  </div>

                  {/* Progress text */}
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatCurrency(goal.current_balance)}
                    </span>{" "}
                    / {formatCurrency(goal.target_amount)}{" "}
                    <span className="text-xs">({pct}%)</span>
                  </p>

                  {/* Target date */}
                  {goal.target_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      <span>Target: {formatDate(goal.target_date)}</span>
                    </div>
                  )}

                  {/* Projection */}
                  {goal.status === "active" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="size-3.5" />
                      <span>
                        {projection ||
                          "Add contributions to see projection"}
                      </span>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-1 pt-1">
                    {goal.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openContributionDialog(goal);
                        }}
                      >
                        <Plus className="size-3.5" data-icon="inline-start" />
                        Add Money
                      </Button>
                    )}
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(goal);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(goal.id);
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? "Edit Goal" : "Create New Goal"}
            </DialogTitle>
            <DialogDescription>
              {editingGoal
                ? "Update the details of this savings goal."
                : "Set up a new savings goal to start tracking your progress."}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            goal={editingGoal}
            onSuccess={handleGoalFormSuccess}
            onCancel={handleGoalFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Add Contribution Dialog */}
      <Dialog
        open={contributionDialogOpen}
        onOpenChange={setContributionDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add Money to {contributionGoal?.name ?? "Goal"}
            </DialogTitle>
            <DialogDescription>
              Record a new contribution towards this goal.
            </DialogDescription>
          </DialogHeader>
          {contributionGoal && (
            <ContributionForm
              goalId={contributionGoal.id}
              goalName={contributionGoal.name}
              onSuccess={handleContributionSuccess}
              onCancel={handleContributionCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Goal Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {detailGoal && (
            <>
              <DialogHeader>
                <DialogTitle>{detailGoal.name}</DialogTitle>
                <DialogDescription>
                  Goal details and contribution history
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                {/* Goal summary */}
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={PRIORITY_STYLES[detailGoal.priority]}
                    >
                      {detailGoal.priority} priority
                    </Badge>
                    {detailGoal.status !== "active" && (
                      <Badge
                        variant="secondary"
                        className={STATUS_STYLES[detailGoal.status]}
                      >
                        {detailGoal.status}
                      </Badge>
                    )}
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${getPercentage(detailGoal.current_balance, detailGoal.target_amount)}%`,
                        backgroundColor: detailGoal.color || "#0d9488",
                      }}
                    />
                  </div>

                  <p className="text-sm">
                    <span className="font-semibold">
                      {formatCurrency(detailGoal.current_balance)}
                    </span>{" "}
                    of {formatCurrency(detailGoal.target_amount)} saved (
                    {getPercentage(
                      detailGoal.current_balance,
                      detailGoal.target_amount
                    )}
                    %)
                  </p>

                  {detailGoal.target_date && (
                    <p className="text-sm text-muted-foreground">
                      Target date: {formatDate(detailGoal.target_date)}
                    </p>
                  )}
                </div>

                {/* Contribution History */}
                <div className="grid gap-2">
                  <h4 className="text-sm font-semibold">
                    Contribution History
                  </h4>

                  {loadingContributions ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : contributions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No contributions yet. Add money to get started!
                    </p>
                  ) : (
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {contributions.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {formatCurrency(c.amount)}
                            </p>
                            {c.source_description && (
                              <p className="text-xs text-muted-foreground">
                                {c.source_description}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(c.date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this savings goal? All
              contributions associated with it will also be removed. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
