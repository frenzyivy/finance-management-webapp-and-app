"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants/categories";
import type { IncomeEntry } from "@/types/database";

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

const incomeFormSchema = z
  .object({
    amount: z.coerce
      .number({ error: "Amount must be a number" })
      .positive({ error: "Amount must be greater than 0" }),
    category: z.enum(["salary", "freelance", "borrowed", "side_income", "other"], {
      error: "Please select a category",
    }),
    source_name: z.string().min(1, { error: "Source name is required" }).max(100),
    date: z.string().min(1, { error: "Date is required" }),
    payment_method: z.enum(
      ["bank_transfer", "upi", "credit_card", "debit_card", "cash", "wallet"],
      { error: "Please select a payment method" }
    ),
    is_recurring: z.boolean(),
    recurrence_frequency: z
      .enum(["weekly", "monthly", "quarterly", "yearly"])
      .nullable(),
    notes: z.string().max(500).nullable(),
  })
  .refine(
    (data) => {
      if (data.is_recurring && !data.recurrence_frequency) return false;
      return true;
    },
    {
      message: "Recurrence frequency is required for recurring income",
      path: ["recurrence_frequency"],
    }
  );

type IncomeFormValues = z.infer<typeof incomeFormSchema>;

interface IncomeFormProps {
  entry?: IncomeEntry;
  onSuccess: () => void;
  onCancel: () => void;
}

export function IncomeForm({ entry, onSuccess, onCancel }: IncomeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!entry;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IncomeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(incomeFormSchema) as any,
    defaultValues: {
      amount: entry?.amount ?? (undefined as unknown as number),
      category: entry?.category ?? undefined,
      source_name: entry?.source_name ?? "",
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      payment_method: entry?.payment_method ?? undefined,
      is_recurring: entry?.is_recurring ?? false,
      recurrence_frequency: entry?.recurrence_frequency ?? null,
      notes: entry?.notes ?? null,
    },
  });

  const isRecurring = watch("is_recurring");
  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const selectedFrequency = watch("recurrence_frequency");

  const onSubmit = async (values: IncomeFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        amount: values.amount,
        category: values.category,
        source_name: values.source_name,
        date: values.date,
        payment_method: values.payment_method,
        is_recurring: values.is_recurring,
        recurrence_frequency: values.is_recurring
          ? values.recurrence_frequency
          : null,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("income_entries")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;
        toast.success("Income entry updated successfully");
      } else {
        const { error } = await supabase
          .from("income_entries")
          .insert(payload);
        if (error) throw error;
        toast.success("Income entry added successfully");
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
      {/* Amount */}
      <div className="grid gap-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("amount")}
        />
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="grid gap-2">
        <Label>Category</Label>
        <Select
          value={selectedCategory ?? ""}
          onValueChange={(val) =>
            setValue("category", val as IncomeFormValues["category"], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {INCOME_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-xs text-destructive">{errors.category.message}</p>
        )}
      </div>

      {/* Source Name */}
      <div className="grid gap-2">
        <Label htmlFor="source_name">Source Name</Label>
        <Input
          id="source_name"
          placeholder="e.g. Acme Corp"
          {...register("source_name")}
        />
        {errors.source_name && (
          <p className="text-xs text-destructive">
            {errors.source_name.message}
          </p>
        )}
      </div>

      {/* Date */}
      <div className="grid gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Payment Method */}
      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select
          value={selectedPaymentMethod ?? ""}
          onValueChange={(val) =>
            setValue(
              "payment_method",
              val as IncomeFormValues["payment_method"],
              { shouldValidate: true }
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm.value} value={pm.value}>
                {pm.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.payment_method && (
          <p className="text-xs text-destructive">
            {errors.payment_method.message}
          </p>
        )}
      </div>

      {/* Is Recurring */}
      <div className="flex items-center gap-2">
        <input
          id="is_recurring"
          type="checkbox"
          className="size-4 rounded border-input accent-primary"
          checked={isRecurring}
          onChange={(e) => {
            setValue("is_recurring", e.target.checked);
            if (!e.target.checked) {
              setValue("recurrence_frequency", null);
            }
          }}
        />
        <Label htmlFor="is_recurring">Recurring income</Label>
      </div>

      {/* Recurrence Frequency */}
      {isRecurring && (
        <div className="grid gap-2">
          <Label>Recurrence Frequency</Label>
          <Select
            value={selectedFrequency ?? ""}
            onValueChange={(val) =>
              setValue(
                "recurrence_frequency",
                val as IncomeFormValues["recurrence_frequency"],
                { shouldValidate: true }
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurrence_frequency && (
            <p className="text-xs text-destructive">
              {errors.recurrence_frequency.message}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update" : "Add Income"}
        </Button>
      </div>
    </form>
  );
}
