"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";
import type { Debt } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const allocationRowSchema = z.object({
  purpose: z.string().min(1, "Purpose is required").max(200),
  amount: z.coerce.number().positive("Amount must be > 0"),
  category: z.string().min(1, "Category is required"),
  sub_category: z.string().max(100).optional(),
  date: z.string().min(1, "Date is required"),
});

const allocationFormSchema = z.object({
  allocations: z.array(allocationRowSchema).min(1, "Add at least one allocation"),
});

type AllocationFormValues = z.infer<typeof allocationFormSchema>;

interface DebtAllocationFormProps {
  debt: Debt;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DebtAllocationForm({
  debt,
  onSuccess,
  onCancel,
}: DebtAllocationFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const existingAllocated = debt.allocated_amount ?? 0;
  const maxAllocatable = debt.original_amount - existingAllocated;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AllocationFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(allocationFormSchema) as any,
    defaultValues: {
      allocations: [
        {
          purpose: "",
          amount: undefined as unknown as number,
          category: "",
          sub_category: "",
          date: debt.start_date ?? new Date().toISOString().split("T")[0],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "allocations",
  });

  const allocations = watch("allocations");
  const totalAllocated =
    allocations?.reduce((sum, a) => sum + (Number(a.amount) || 0), 0) ?? 0;
  const remaining = maxAllocatable - totalAllocated;
  const progressPercent =
    maxAllocatable > 0
      ? Math.min(100, ((existingAllocated + totalAllocated) / debt.original_amount) * 100)
      : 0;

  const onSubmit = async (values: AllocationFormValues) => {
    if (totalAllocated > maxAllocatable) {
      toast.error(
        `Total allocations (${formatCurrency(totalAllocated)}) exceed available amount (${formatCurrency(maxAllocatable)})`
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const allocPayload = values.allocations.map((a) => ({
        amount: a.amount,
        category: a.category,
        sub_category: a.sub_category || null,
        payee_name: `${debt.creditor_name} (debt)`,
        date: a.date,
        description: a.purpose,
        payment_method: "bank_transfer",
      }));

      const { error } = await supabase.rpc("create_debt_allocations", {
        p_debt_id: debt.id,
        p_user_id: user.id,
        p_allocations: allocPayload,
      });

      if (error) throw error;
      toast.success(
        `${formatCurrency(totalAllocated)} allocated across ${values.allocations.length} expense(s)`
      );
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
      {/* Debt Summary */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-medium">
          {formatCurrency(debt.original_amount)} from {debt.creditor_name}
        </p>
        <p className="text-xs text-muted-foreground">{debt.name}</p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span>
              Allocated: {formatCurrency(existingAllocated + totalAllocated)} /{" "}
              {formatCurrency(debt.original_amount)}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      {/* Allocation Rows */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Allocation {index + 1}
              </Label>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor={`purpose-${index}`} className="text-xs">
                  Purpose
                </Label>
                <Input
                  id={`purpose-${index}`}
                  placeholder="e.g. Room deposit"
                  {...register(`allocations.${index}.purpose`)}
                />
                {errors.allocations?.[index]?.purpose && (
                  <p className="text-xs text-destructive">
                    {errors.allocations[index].purpose.message}
                  </p>
                )}
              </div>

              <div className="grid gap-1">
                <Label htmlFor={`amount-${index}`} className="text-xs">
                  Amount
                </Label>
                <Input
                  id={`amount-${index}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register(`allocations.${index}.amount`)}
                />
                {errors.allocations?.[index]?.amount && (
                  <p className="text-xs text-destructive">
                    {errors.allocations[index].amount.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">Category</Label>
                <Select
                  value={allocations?.[index]?.category ?? ""}
                  onValueChange={(val) => {
                    if (val) setValue(`allocations.${index}.category` as `allocations.0.category`, val, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.filter(
                      (c) => c.value !== "debt_repayment"
                    ).map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.allocations?.[index]?.category && (
                  <p className="text-xs text-destructive">
                    {errors.allocations[index].category.message}
                  </p>
                )}
              </div>

              <div className="grid gap-1">
                <Label htmlFor={`date-${index}`} className="text-xs">
                  Date
                </Label>
                <Input
                  id={`date-${index}`}
                  type="date"
                  {...register(`allocations.${index}.date`)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add row */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            purpose: "",
            amount: undefined as unknown as number,
            category: "",
            sub_category: "",
            date: debt.start_date ?? new Date().toISOString().split("T")[0],
          })
        }
      >
        <Plus className="size-4" />
        Add allocation
      </Button>

      {/* Remaining indicator */}
      {remaining < 0 && (
        <p className="text-xs font-medium text-destructive">
          Over-allocated by {formatCurrency(Math.abs(remaining))}
        </p>
      )}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatCurrency(remaining)} remaining to allocate
        </p>
      )}
      {remaining === 0 && totalAllocated > 0 && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          Fully allocated
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Skip for now
        </Button>
        <Button
          type="submit"
          disabled={submitting || totalAllocated <= 0 || remaining < 0}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Save Allocations
        </Button>
      </div>
    </form>
  );
}
