"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/components/komal";
import { formatDate } from "@/lib/utils/date";
import { useGoalsStore } from "@/lib/stores/goals-store";
import type { GoalV2 } from "@/types/goals-v2";

import {
  addContribution,
  deleteGoal as deleteGoalAction,
  updateGoal,
} from "@/app/(dashboard)/goals/v2/actions";

interface GoalDetailDialogProps {
  goalId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (goal: GoalV2) => void;
}

function pct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((saved / target) * 100), 100);
}

export function GoalDetailDialog({
  goalId,
  onOpenChange,
  onEdit,
}: GoalDetailDialogProps) {
  const allGoals = useGoalsStore((s) => s.goals);
  const contribMap = useGoalsStore((s) => s.contributionsByGoal);
  const categories = useGoalsStore((s) => s.categories);
  const applyContribution = useGoalsStore((s) => s.applyContribution);
  const upsertGoal = useGoalsStore((s) => s.upsertGoal);
  const removeGoal = useGoalsStore((s) => s.removeGoal);

  const goal = useMemo(
    () => (goalId ? allGoals.find((g) => g.id === goalId) ?? null : null),
    [allGoals, goalId],
  );
  const contributions = useMemo(
    () => (goalId ? contribMap[goalId] ?? [] : []),
    [contribMap, goalId],
  );

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [isAdding, startAdd] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isReassigning, startReassign] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOpen = !!goal;

  const handleAddMoney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    startAdd(async () => {
      try {
        const res = await addContribution({
          goal_id: goal.id,
          amount: amt,
          date,
          source_description: source.trim() || null,
        });
        applyContribution(res.contribution, res.goal);
        setAmount("");
        setSource("");
        toast.success(`Added ${formatINR(amt)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add";
        toast.error(msg);
      }
    });
  };

  const handleReassign = (nextValue: string | null) => {
    if (!goal) return;
    const next = nextValue === "__none__" ? null : nextValue;
    if (next === (goal.category_id ?? null)) return;
    startReassign(async () => {
      try {
        const updated = await updateGoal({
          id: goal.id,
          category_id: next,
        });
        upsertGoal(updated);
        toast.success("Category updated");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to move";
        toast.error(msg);
      }
    });
  };

  const handleDelete = () => {
    if (!goal) return;
    startDelete(async () => {
      try {
        await deleteGoalAction(goal.id);
        removeGoal(goal.id);
        toast.success("Goal deleted");
        onOpenChange(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        toast.error(msg);
      }
    });
  };

  if (!isOpen || !goal) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const saved = Number(goal.current_balance) || 0;
  const target = Number(goal.target_amount) || 0;
  const percent = pct(saved, target);
  const remaining = Math.max(target - saved, 0);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmDelete(false);
          setAmount("");
          setSource("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>
            {goal.target_date
              ? `Target: ${formatDate(goal.target_date)}`
              : "No deadline set"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-2">
          <div
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div className="flex items-baseline justify-between">
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {formatINR(saved)}
              </span>
              <span
                style={{ fontSize: 12, color: "var(--text-tertiary)" }}
              >
                of {formatINR(target)} ({percent}%)
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--surface)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {remaining > 0
                ? `${formatINR(remaining)} to go`
                : "Target reached"}
            </div>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Label
              htmlFor="goal-reassign"
              className="text-xs whitespace-nowrap"
              style={{ color: "var(--text-secondary)" }}
            >
              Category
            </Label>
            <div className="flex-1">
              <Select
                value={goal.category_id ?? "__none__"}
                onValueChange={(v) => handleReassign(v as string | null)}
                disabled={isReassigning}
              >
                <SelectTrigger id="goal-reassign">
                  <SelectValue>
                    {(value) => {
                      if (value === "__none__" || value == null)
                        return "Uncategorized";
                      return (
                        categories.find((c) => c.id === value)?.name ??
                        "Uncategorized"
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Uncategorized</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isReassigning && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <form
            onSubmit={handleAddMoney}
            className="grid gap-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-soft)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
              Add money
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="add-amount" className="text-xs">
                  Amount (₹)
                </Label>
                <Input
                  id="add-amount"
                  type="number"
                  min={1}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-date" className="text-xs">
                  Date
                </Label>
                <Input
                  id="add-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="add-source" className="text-xs">
                Source (optional)
              </Label>
              <Input
                id="add-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Salary, Bonus"
              />
            </div>
            <Button type="submit" disabled={isAdding} size="sm">
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </Button>
          </form>

          {contributions.length > 0 && (
            <details
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <summary
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Contribution history ({contributions.length})
              </summary>
              <div className="flex flex-col gap-1.5 mt-2 max-h-48 overflow-y-auto">
                {contributions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between"
                    style={{
                      fontSize: 12,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "var(--surface-alt)",
                    }}
                  >
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {formatINR(c.amount)}
                      {c.source_description
                        ? ` · ${c.source_description}`
                        : ""}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {formatDate(c.date)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(goal)}
            >
              <Pencil className="size-4" /> Edit goal
            </Button>
            {!confirmDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                style={{ color: "var(--expense)", borderColor: "var(--expense-light)" }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="size-4 animate-spin" />}
                  Confirm delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
