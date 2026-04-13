"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Schema ─────────────────────────────────────────────────────────────

const contributionFormSchema = z.object({
  amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive({ error: "Amount must be greater than 0" }),
  date: z.string().min(1, { error: "Date is required" }),
  source_description: z.string().max(200).nullable(),
  notes: z.string().max(500).nullable(),
});

type ContributionFormValues = z.infer<typeof contributionFormSchema>;

// ── Component ──────────────────────────────────────────────────────────

interface ContributionFormProps {
  goalId: string;
  goalName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContributionForm({
  goalId,
  goalName,
  onSuccess,
  onCancel,
}: ContributionFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContributionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(contributionFormSchema) as any,
    defaultValues: {
      amount: undefined as unknown as number,
      date: new Date().toISOString().split("T")[0],
      source_description: null,
      notes: null,
    },
  });

  const onSubmit = async (values: ContributionFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert the contribution
      const { error: contribError } = await supabase
        .from("savings_contributions")
        .insert({
          user_id: user.id,
          goal_id: goalId,
          amount: values.amount,
          date: values.date,
          source_description: values.source_description || null,
          notes: values.notes || null,
        });

      if (contribError) throw contribError;

      // Get the current goal balance
      const { data: goal, error: goalError } = await supabase
        .from("savings_goals")
        .select("current_balance, target_amount")
        .eq("id", goalId)
        .single();

      if (goalError) throw goalError;

      const newBalance = goal.current_balance + values.amount;
      const updates: Record<string, unknown> = {
        current_balance: newBalance,
      };

      // Mark as completed if target reached
      if (newBalance >= goal.target_amount) {
        updates.status = "completed";
      }

      const { error: updateError } = await supabase
        .from("savings_goals")
        .update(updates)
        .eq("id", goalId);

      if (updateError) throw updateError;

      toast.success(`Added to ${goalName}`);
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      {/* Amount + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contrib-amount">Amount</Label>
          <Input
            id="contrib-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            autoFocus
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contrib-date">Date</Label>
          <Input id="contrib-date" type="date" {...register("date")} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      {/* Source Description */}
      <div className="grid gap-2">
        <Label htmlFor="source_description">Source (optional)</Label>
        <Input
          id="source_description"
          placeholder="e.g. Salary, Bonus, Side hustle"
          {...register("source_description")}
        />
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="contrib-notes">Notes (optional)</Label>
        <textarea
          id="contrib-notes"
          rows={2}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Add Money
        </Button>
      </div>
    </form>
  );
}
