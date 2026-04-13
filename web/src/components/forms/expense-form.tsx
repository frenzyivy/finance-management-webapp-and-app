"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/constants/categories";
import type { ExpenseEntry } from "@/types/database";

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

const expenseFormSchema = z
  .object({
    amount: z.coerce
      .number({ error: "Amount must be a number" })
      .positive({ error: "Amount must be greater than 0" }),
    category: z.enum(
      [
        "credit_card_payments",
        "emis",
        "rent",
        "food_groceries",
        "utilities",
        "transport",
        "shopping",
        "health",
        "education",
        "entertainment",
        "subscriptions",
        "family_personal",
        "miscellaneous",
      ],
      { error: "Please select a category" }
    ),
    sub_category: z.string().max(100).nullable(),
    payee_name: z.string().min(1, { error: "Payee name is required" }).max(100),
    date: z.string().min(1, { error: "Date is required" }),
    payment_method: z.enum(
      ["bank_transfer", "upi", "credit_card", "debit_card", "cash", "wallet"],
      { error: "Please select a payment method" }
    ),
    is_emi: z.boolean(),
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
      message: "Recurrence frequency is required for recurring expenses",
      path: ["recurrence_frequency"],
    }
  );

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  entry?: ExpenseEntry;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ entry, onSuccess, onCancel }: ExpenseFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!entry;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseFormSchema) as any,
    defaultValues: {
      amount: entry?.amount ?? (undefined as unknown as number),
      category: entry?.category ?? undefined,
      sub_category: entry?.sub_category ?? null,
      payee_name: entry?.payee_name ?? "",
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      payment_method: entry?.payment_method ?? undefined,
      is_emi: entry?.is_emi ?? false,
      is_recurring: entry?.is_recurring ?? false,
      recurrence_frequency: entry?.recurrence_frequency ?? null,
      notes: entry?.notes ?? null,
    },
  });

  const isRecurring = watch("is_recurring");
  const isEmi = watch("is_emi");
  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const selectedFrequency = watch("recurrence_frequency");

  const onSubmit = async (values: ExpenseFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        amount: values.amount,
        category: values.category,
        sub_category: values.sub_category || null,
        payee_name: values.payee_name,
        date: values.date,
        payment_method: values.payment_method,
        is_emi: values.is_emi,
        is_recurring: values.is_recurring,
        recurrence_frequency: values.is_recurring
          ? values.recurrence_frequency
          : null,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("expense_entries")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;
        toast.success("Expense entry updated successfully");
      } else {
        const { error } = await supabase
          .from("expense_entries")
          .insert(payload);
        if (error) throw error;
        toast.success("Expense entry added successfully");
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
      {/* Row 1: Amount + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="grid gap-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      {/* Row 2: Payee Name */}
      <div className="grid gap-2">
        <Label htmlFor="payee_name">Payee Name</Label>
        <Input
          id="payee_name"
          placeholder="e.g. Amazon, Swiggy, Landlord"
          {...register("payee_name")}
        />
        {errors.payee_name && (
          <p className="text-xs text-destructive">
            {errors.payee_name.message}
          </p>
        )}
      </div>

      {/* Row 3: Category + Sub-category */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select
            value={selectedCategory ?? ""}
            onValueChange={(val) =>
              setValue("category", val as ExpenseFormValues["category"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-destructive">
              {errors.category.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sub_category">Sub-category (optional)</Label>
          <Input
            id="sub_category"
            placeholder="e.g. Dining out, Petrol"
            {...register("sub_category")}
          />
        </div>
      </div>

      {/* Row 4: Payment Method */}
      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select
          value={selectedPaymentMethod ?? ""}
          onValueChange={(val) =>
            setValue(
              "payment_method",
              val as ExpenseFormValues["payment_method"],
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

      {/* Row 5: Checkboxes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            id="is_emi"
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={isEmi}
            onChange={(e) => setValue("is_emi", e.target.checked)}
          />
          <Label htmlFor="is_emi">EMI payment</Label>
        </div>

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
          <Label htmlFor="is_recurring">Recurring expense</Label>
        </div>
      </div>

      {/* Recurrence Frequency (conditional) */}
      {isRecurring && (
        <div className="grid gap-2">
          <Label>Recurrence Frequency</Label>
          <Select
            value={selectedFrequency ?? ""}
            onValueChange={(val) =>
              setValue(
                "recurrence_frequency",
                val as ExpenseFormValues["recurrence_frequency"],
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
          {isEditing ? "Update" : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}
