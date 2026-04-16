"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { UNCATEGORIZED_ID, useGoalsStore } from "@/lib/stores/goals-store";
import type { GoalV2 } from "@/types/goals-v2";

import {
  createGoal,
  updateGoal,
} from "@/app/(dashboard)/goals/v2/actions";

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalV2 | null; // present → edit mode
  initialCategoryId?: string | null; // seed for create mode
}

type PriorityOption = "high" | "medium" | "low";

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  initialCategoryId,
}: GoalFormDialogProps) {
  const categories = useGoalsStore((s) => s.categories);
  const upsertGoal = useGoalsStore((s) => s.upsertGoal);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState<PriorityOption>("medium");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const isEdit = !!goal;

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setName(goal.name);
      setTargetAmount(String(goal.target_amount ?? ""));
      setTargetDate(goal.target_date ?? "");
      setPriority(goal.priority);
      setCategoryId(goal.category_id ?? "__none__");
      setNotes(goal.notes ?? "");
    } else {
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setPriority("medium");
      setCategoryId(
        initialCategoryId && initialCategoryId !== UNCATEGORIZED_ID
          ? initialCategoryId
          : "__none__",
      );
      setNotes("");
    }
  }, [open, goal, initialCategoryId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const amt = Number(targetAmount);
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Target amount must be greater than 0");
      return;
    }

    const resolvedCategoryId = categoryId === "__none__" ? null : categoryId;

    startTransition(async () => {
      try {
        if (isEdit && goal) {
          const updated = await updateGoal({
            id: goal.id,
            name: trimmed,
            target_amount: amt,
            target_date: targetDate || null,
            priority,
            category_id: resolvedCategoryId,
            notes: notes.trim() || null,
          });
          upsertGoal(updated);
          toast.success("Goal updated");
        } else {
          const created = await createGoal({
            name: trimmed,
            target_amount: amt,
            target_date: targetDate || null,
            priority,
            category_id: resolvedCategoryId,
            notes: notes.trim() || null,
            color: null,
            icon: null,
          });
          upsertGoal(created);
          toast.success("Goal created");
        }
        onOpenChange(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this goal."
              : "Set a target you want to save towards."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. M5 Laptop"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="goal-target">Target amount (₹)</Label>
            <Input
              id="goal-target"
              type="number"
              min={1}
              step="1"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="400000"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-date">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as PriorityOption)}
              >
                <SelectTrigger id="goal-priority">
                  <SelectValue>
                    {(value) => {
                      const v = String(value ?? "medium");
                      return v.charAt(0).toUpperCase() + v.slice(1);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="goal-category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId((v as string | null) ?? "__none__")}
            >
              <SelectTrigger id="goal-category">
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

          <div className="grid gap-1.5">
            <Label htmlFor="goal-notes">Notes</Label>
            <Input
              id="goal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
