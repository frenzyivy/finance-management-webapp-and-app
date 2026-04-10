"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { DEBT_TYPES } from "@/lib/constants/categories";
import type { Debt } from "@/types/database";

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

const debtFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Debt name is required" })
    .max(100),
  type: z.enum(
    ["credit_card", "personal_loan", "bnpl", "borrowed_from_person", "other"],
    { error: "Please select a debt type" }
  ),
  creditor_name: z
    .string()
    .min(1, { error: "Creditor name is required" })
    .max(100),
  original_amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive({ error: "Amount must be greater than 0" }),
  outstanding_balance: z.coerce
    .number({ error: "Balance must be a number" })
    .min(0, { error: "Balance cannot be negative" }),
  interest_rate: z.coerce
    .number({ error: "Interest rate must be a number" })
    .min(0, { error: "Interest rate cannot be negative" })
    .optional()
    .or(z.literal("")),
  emi_amount: z.coerce
    .number({ error: "EMI must be a number" })
    .positive({ error: "EMI must be greater than 0" })
    .optional()
    .or(z.literal("")),
  emi_day_of_month: z.coerce
    .number({ error: "Day must be a number" })
    .int()
    .min(1, { error: "Day must be between 1 and 31" })
    .max(31, { error: "Day must be between 1 and 31" })
    .optional()
    .or(z.literal("")),
  total_emis: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .positive({ error: "Must be greater than 0" })
    .optional()
    .or(z.literal("")),
  remaining_emis: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .min(0, { error: "Cannot be negative" })
    .optional()
    .or(z.literal("")),
  start_date: z.string().min(1, { error: "Start date is required" }),
  expected_payoff_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type DebtFormValues = z.infer<typeof debtFormSchema>;

interface DebtFormProps {
  debt?: Debt;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DebtForm({ debt, onSuccess, onCancel }: DebtFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!debt;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DebtFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(debtFormSchema) as any,
    defaultValues: {
      name: debt?.name ?? "",
      type: debt?.type ?? undefined,
      creditor_name: debt?.creditor_name ?? "",
      original_amount: debt?.original_amount ?? (undefined as unknown as number),
      outstanding_balance: debt?.outstanding_balance ?? (undefined as unknown as number),
      interest_rate: debt?.interest_rate ?? "",
      emi_amount: debt?.emi_amount ?? "",
      emi_day_of_month: debt?.emi_day_of_month ?? "",
      total_emis: debt?.total_emis ?? "",
      remaining_emis: debt?.remaining_emis ?? "",
      start_date: debt?.start_date ?? new Date().toISOString().split("T")[0],
      expected_payoff_date: debt?.expected_payoff_date ?? "",
      notes: debt?.notes ?? "",
    },
  });

  const selectedType = watch("type");

  const onSubmit = async (values: DebtFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        name: values.name,
        type: values.type,
        creditor_name: values.creditor_name,
        original_amount: values.original_amount,
        outstanding_balance: values.outstanding_balance,
        interest_rate:
          values.interest_rate !== "" && values.interest_rate !== undefined
            ? Number(values.interest_rate)
            : 0,
        emi_amount:
          values.emi_amount !== "" && values.emi_amount !== undefined
            ? Number(values.emi_amount)
            : null,
        emi_day_of_month:
          values.emi_day_of_month !== "" && values.emi_day_of_month !== undefined
            ? Number(values.emi_day_of_month)
            : null,
        total_emis:
          values.total_emis !== "" && values.total_emis !== undefined
            ? Number(values.total_emis)
            : null,
        remaining_emis:
          values.remaining_emis !== "" && values.remaining_emis !== undefined
            ? Number(values.remaining_emis)
            : null,
        start_date: values.start_date,
        expected_payoff_date: values.expected_payoff_date || null,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("debts")
          .update(payload)
          .eq("id", debt.id);
        if (error) throw error;
        toast.success("Debt updated successfully");
      } else {
        const { error } = await supabase.from("debts").insert(payload);
        if (error) throw error;
        toast.success("Debt added successfully");
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
      {/* Row 1: Name + Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Debt Name</Label>
          <Input
            id="name"
            placeholder="e.g. HDFC Credit Card"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Type</Label>
          <Select
            value={selectedType ?? ""}
            onValueChange={(val) =>
              setValue("type", val as DebtFormValues["type"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {DEBT_TYPES.map((dt) => (
                <SelectItem key={dt.value} value={dt.value}>
                  {dt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-xs text-destructive">{errors.type.message}</p>
          )}
        </div>
      </div>

      {/* Row 2: Creditor Name */}
      <div className="grid gap-2">
        <Label htmlFor="creditor_name">Creditor Name</Label>
        <Input
          id="creditor_name"
          placeholder="e.g. HDFC Bank, Amazon, Friend"
          {...register("creditor_name")}
        />
        {errors.creditor_name && (
          <p className="text-xs text-destructive">
            {errors.creditor_name.message}
          </p>
        )}
      </div>

      {/* Row 3: Original Amount + Outstanding Balance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="original_amount">Original Amount</Label>
          <Input
            id="original_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("original_amount")}
          />
          {errors.original_amount && (
            <p className="text-xs text-destructive">
              {errors.original_amount.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="outstanding_balance">Outstanding Balance</Label>
          <Input
            id="outstanding_balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("outstanding_balance")}
          />
          {errors.outstanding_balance && (
            <p className="text-xs text-destructive">
              {errors.outstanding_balance.message}
            </p>
          )}
        </div>
      </div>

      {/* Row 4: Interest Rate + EMI Amount */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input
            id="interest_rate"
            type="number"
            step="0.01"
            placeholder="e.g. 12.5"
            {...register("interest_rate")}
          />
          {errors.interest_rate && (
            <p className="text-xs text-destructive">
              {errors.interest_rate.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="emi_amount">EMI Amount (optional)</Label>
          <Input
            id="emi_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("emi_amount")}
          />
          {errors.emi_amount && (
            <p className="text-xs text-destructive">
              {errors.emi_amount.message}
            </p>
          )}
        </div>
      </div>

      {/* Row 5: EMI Day + Total EMIs + Remaining EMIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="emi_day_of_month">EMI Day (1-31)</Label>
          <Input
            id="emi_day_of_month"
            type="number"
            min={1}
            max={31}
            placeholder="e.g. 15"
            {...register("emi_day_of_month")}
          />
          {errors.emi_day_of_month && (
            <p className="text-xs text-destructive">
              {errors.emi_day_of_month.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="total_emis">Total EMIs</Label>
          <Input
            id="total_emis"
            type="number"
            placeholder="e.g. 12"
            {...register("total_emis")}
          />
          {errors.total_emis && (
            <p className="text-xs text-destructive">
              {errors.total_emis.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="remaining_emis">Remaining EMIs</Label>
          <Input
            id="remaining_emis"
            type="number"
            placeholder="e.g. 6"
            {...register("remaining_emis")}
          />
          {errors.remaining_emis && (
            <p className="text-xs text-destructive">
              {errors.remaining_emis.message}
            </p>
          )}
        </div>
      </div>

      {/* Row 6: Start Date + Expected Payoff Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
          {errors.start_date && (
            <p className="text-xs text-destructive">
              {errors.start_date.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expected_payoff_date">
            Expected Payoff Date (optional)
          </Label>
          <Input
            id="expected_payoff_date"
            type="date"
            {...register("expected_payoff_date")}
          />
        </div>
      </div>

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
          {isEditing ? "Update Debt" : "Add Debt"}
        </Button>
      </div>
    </form>
  );
}
