"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { SavingsGoal } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { value: "#0d9488", label: "Teal" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#22c55e", label: "Green" },
];

const ICON_OPTIONS = [
  { value: "piggy-bank", label: "Piggy Bank" },
  { value: "shield", label: "Shield" },
  { value: "graduation-cap", label: "Graduation Cap" },
  { value: "plane", label: "Plane" },
  { value: "home", label: "Home" },
  { value: "heart", label: "Heart" },
  { value: "star", label: "Star" },
  { value: "gift", label: "Gift" },
];

// ── Schema ─────────────────────────────────────────────────────────────

const goalFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Goal name is required" })
    .max(100),
  target_amount: z.coerce
    .number({ error: "Target amount must be a number" })
    .positive({ error: "Target amount must be greater than 0" }),
  priority: z.enum(["high", "medium", "low"], {
    error: "Please select a priority",
  }),
  target_date: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  status: z.enum(["active", "completed", "paused"]).optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

// ── Component ──────────────────────────────────────────────────────────

interface GoalFormProps {
  goal?: SavingsGoal;
  onSuccess: () => void;
  onCancel: () => void;
}

export function GoalForm({ goal, onSuccess, onCancel }: GoalFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!goal;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GoalFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(goalFormSchema) as any,
    defaultValues: {
      name: goal?.name ?? "",
      target_amount: goal?.target_amount ?? (undefined as unknown as number),
      priority: goal?.priority ?? "medium",
      target_date: goal?.target_date ?? null,
      color: goal?.color ?? COLOR_SWATCHES[0].value,
      icon: goal?.icon ?? "piggy-bank",
      status: goal?.status ?? "active",
    },
  });

  const selectedColor = watch("color");
  const selectedIcon = watch("icon");
  const selectedPriority = watch("priority");
  const selectedStatus = watch("status");

  const onSubmit = async (values: GoalFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        name: values.name,
        target_amount: values.target_amount,
        priority: values.priority,
        target_date: values.target_date || null,
        color: values.color || null,
        icon: values.icon || null,
        ...(isEditing ? { status: values.status ?? "active" } : {}),
      };

      if (isEditing) {
        const { error } = await supabase
          .from("savings_goals")
          .update(payload)
          .eq("id", goal.id);
        if (error) throw error;
        toast.success("Goal updated successfully");
      } else {
        const { error } = await supabase
          .from("savings_goals")
          .insert(payload);
        if (error) throw error;
        toast.success("Goal created successfully");
      }

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
      {/* Goal Name */}
      <div className="grid gap-2">
        <Label htmlFor="name">Goal Name</Label>
        <Input
          id="name"
          placeholder="e.g. Emergency Fund, Vacation, New Car"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Target Amount + Priority */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="target_amount">Target Amount</Label>
          <Input
            id="target_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("target_amount")}
          />
          {errors.target_amount && (
            <p className="text-xs text-destructive">
              {errors.target_amount.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Priority</Label>
          <Select
            value={selectedPriority ?? "medium"}
            onValueChange={(val) =>
              setValue("priority", val as GoalFormValues["priority"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-xs text-destructive">
              {errors.priority.message}
            </p>
          )}
        </div>
      </div>

      {/* Target Date */}
      <div className="grid gap-2">
        <Label htmlFor="target_date">Target Date (optional)</Label>
        <Input
          id="target_date"
          type="date"
          {...register("target_date")}
        />
      </div>

      {/* Color Swatches */}
      <div className="grid gap-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              title={swatch.label}
              className={cn(
                "relative size-8 rounded-full transition-all",
                selectedColor === swatch.value
                  ? "ring-2 ring-offset-2 ring-offset-background ring-current"
                  : "hover:scale-110"
              )}
              style={{
                backgroundColor: swatch.value,
                color: swatch.value,
              }}
              onClick={() => setValue("color", swatch.value)}
            >
              {selectedColor === swatch.value && (
                <Check className="absolute inset-0 m-auto size-4 text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Select */}
      <div className="grid gap-2">
        <Label>Icon</Label>
        <Select
          value={selectedIcon ?? "piggy-bank"}
          onValueChange={(val) => setValue("icon", val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select icon" />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((icon) => (
              <SelectItem key={icon.value} value={icon.value}>
                {icon.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status (edit mode only) */}
      {isEditing && (
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={selectedStatus ?? "active"}
            onValueChange={(val) =>
              setValue("status", val as GoalFormValues["status"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update Goal" : "Create Goal"}
        </Button>
      </div>
    </form>
  );
}
