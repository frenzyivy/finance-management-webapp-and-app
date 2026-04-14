"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { BusinessExpense, BusinessIncome } from "@/types/business";

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

const formSchema = z.object({
  direction: z.enum(["personal_to_business", "business_to_personal"]),
  amount: z.coerce.number({ message: "Amount required" }).positive({ message: "Must be > 0" }),
  date: z.string().min(1, { message: "Date is required" }),
  reason: z.string().min(1, { message: "Reason is required" }).max(200),
  business_expense_id: z.string().nullable(),
  business_income_id: z.string().nullable(),
  notes: z.string().max(500).nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface LogTransferFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function LogTransferForm({ onSuccess, onCancel }: LogTransferFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [businessExpenses, setBusinessExpenses] = useState<BusinessExpense[]>([]);
  const [businessIncome, setBusinessIncome] = useState<BusinessIncome[]>([]);

  useEffect(() => {
    async function fetchRelated() {
      const supabase = createClient();
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)
        .toISOString()
        .split("T")[0];

      const [expRes, incRes] = await Promise.all([
        supabase
          .from("business_expenses")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
        supabase
          .from("business_income")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
      ]);
      if (expRes.data) setBusinessExpenses(expRes.data);
      if (incRes.data) setBusinessIncome(incRes.data);
    }
    fetchRelated();
  }, []);

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      direction: "personal_to_business",
      amount: undefined as unknown as number,
      date: new Date().toISOString().split("T")[0],
      reason: "",
      business_expense_id: null,
      business_income_id: null,
      notes: null,
    },
  });

  const direction = watch("direction");
  const businessExpenseId = watch("business_expense_id");
  const businessIncomeId = watch("business_income_id");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Use the RPC for atomic creation of transfer + personal mirror
      const { error } = await supabase.rpc("log_personal_business_transfer", {
        p_user_id: user.id,
        p_direction: values.direction,
        p_amount: values.amount,
        p_date: values.date,
        p_reason: values.reason,
        p_business_expense_id:
          values.direction === "personal_to_business" ? values.business_expense_id || null : null,
        p_business_income_id:
          values.direction === "business_to_personal" ? values.business_income_id || null : null,
        p_notes: values.notes || null,
      });
      if (error) throw error;
      toast.success("Transfer logged");
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      {/* Direction */}
      <div className="grid gap-2">
        <Label>Direction</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setValue("direction", "personal_to_business");
              setValue("business_income_id", null);
            }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
              direction === "personal_to_business"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "border-border hover:bg-muted"
            }`}
          >
            <ArrowRight className="size-4" />
            <span className="font-medium">Personal → Business</span>
            <span className="text-xs text-muted-foreground">Invest personal money into business</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setValue("direction", "business_to_personal");
              setValue("business_expense_id", null);
            }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
              direction === "business_to_personal"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-border hover:bg-muted"
            }`}
          >
            <ArrowLeft className="size-4" />
            <span className="font-medium">Business → Personal</span>
            <span className="text-xs text-muted-foreground">Withdraw from business to personal</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          placeholder={
            direction === "personal_to_business"
              ? "e.g. Paid for VPS hosting, Funded new ad campaign"
              : "e.g. Monthly salary, Client payment withdrawal"
          }
          {...register("reason")}
        />
        {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
      </div>

      {/* Optional link to existing business entry */}
      {direction === "personal_to_business" && (
        <div className="grid gap-2">
          <Label>Link to existing business expense (optional)</Label>
          <Select
            value={businessExpenseId ?? "__none__"}
            onValueChange={(val) => setValue("business_expense_id", val === "__none__" ? null : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {businessExpenses.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.vendor_name} — ₹{e.amount} ({e.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {direction === "business_to_personal" && (
        <div className="grid gap-2">
          <Label>Link to existing business income (optional)</Label>
          <Select
            value={businessIncomeId ?? "__none__"}
            onValueChange={(val) => setValue("business_income_id", val === "__none__" ? null : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {businessIncome.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.source_name} — ₹{i.amount} ({i.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={2}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Log Transfer
        </Button>
      </div>
    </form>
  );
}