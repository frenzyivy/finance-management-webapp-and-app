"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_INCOME_CATEGORIES,
  LANDED_IN_OPTIONS,
} from "@/lib/constants/business-categories";
import { PAYMENT_METHODS } from "@/lib/constants/categories";
import type { BusinessIncome, BusinessClient } from "@/types/business";

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

const formSchema = z
  .object({
    amount: z.coerce
      .number({ message: "Amount must be a number" })
      .positive({ message: "Amount must be greater than 0" }),
    category: z.enum(
      ["client_project", "retainer", "freelance_platform", "affiliate_commission", "consultation", "one_off_gig", "refund", "other"],
      { message: "Please select a category" }
    ),
    source_name: z.string().min(1, { message: "Source name is required" }).max(100),
    project_name: z.string().max(100).nullable(),
    client_id: z.string().nullable(),
    invoice_number: z.string().max(50).nullable(),
    date: z.string().min(1, { message: "Date is required" }),
    payment_method: z.string().nullable(),
    landed_in: z.enum(["personal_account", "business_direct", "reinvested"]),
    is_recurring: z.boolean(),
    recurrence_frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable(),
    notes: z.string().max(500).nullable(),
  })
  .refine(
    (data) => !(data.is_recurring && !data.recurrence_frequency),
    { message: "Recurrence frequency is required", path: ["recurrence_frequency"] }
  );

type FormValues = z.infer<typeof formSchema>;

interface BusinessIncomeFormProps {
  entry?: BusinessIncome;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BusinessIncomeForm({ entry, onSuccess, onCancel }: BusinessIncomeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const isEditing = !!entry;

  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from("business_clients")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (data) setClients(data);
    }
    fetchClients();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      amount: entry?.amount ?? (undefined as unknown as number),
      category: entry?.category ?? undefined,
      source_name: entry?.source_name ?? "",
      project_name: entry?.project_name ?? null,
      client_id: entry?.client_id ?? null,
      invoice_number: entry?.invoice_number ?? null,
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      payment_method: entry?.payment_method ?? null,
      landed_in: entry?.landed_in ?? "personal_account",
      is_recurring: entry?.is_recurring ?? false,
      recurrence_frequency: (entry?.recurrence_frequency as FormValues["recurrence_frequency"]) ?? null,
      notes: entry?.notes ?? null,
    },
  });

  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const selectedClientId = watch("client_id");
  const landedIn = watch("landed_in");
  const isRecurring = watch("is_recurring");
  const selectedFrequency = watch("recurrence_frequency");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        amount: values.amount,
        category: values.category,
        source_name: values.source_name,
        project_name: values.project_name || null,
        client_id: values.client_id || null,
        invoice_number: values.invoice_number || null,
        date: values.date,
        payment_method: values.payment_method || null,
        landed_in: values.landed_in,
        is_recurring: values.is_recurring,
        recurrence_frequency: values.is_recurring ? values.recurrence_frequency : null,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("business_income")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;
        toast.success("Business income updated");
      } else {
        const { error } = await supabase
          .from("business_income")
          .insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("Business income added");
      }

      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
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
        <Label htmlFor="source_name">Source / Client Name</Label>
        <Input id="source_name" placeholder="e.g. Dr. Singh Clinic, Upwork" {...register("source_name")} />
        {errors.source_name && <p className="text-xs text-destructive">{errors.source_name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select
            value={selectedCategory ?? ""}
            onValueChange={(val) => setValue("category", val as FormValues["category"], { shouldValidate: true })}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {BUSINESS_INCOME_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label>Client (optional)</Label>
          <Select
            value={selectedClientId ?? ""}
            onValueChange={(val) => setValue("client_id", val || null)}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="project_name">Project Name (optional)</Label>
          <Input id="project_name" placeholder="e.g. Website Redesign" {...register("project_name")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoice_number">Invoice # (optional)</Label>
          <Input id="invoice_number" placeholder="e.g. INV-2026-042" {...register("invoice_number")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select
          value={selectedPaymentMethod ?? ""}
          onValueChange={(val) => setValue("payment_method", val)}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Select method" /></SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Where did this money land?</Label>
        <div className="flex flex-wrap gap-3">
          {LANDED_IN_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="landed_in"
                value={opt.value}
                checked={landedIn === opt.value}
                onChange={() => setValue("landed_in", opt.value as FormValues["landed_in"])}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="is_recurring"
          type="checkbox"
          className="size-4 rounded border-input accent-primary"
          checked={isRecurring}
          onChange={(e) => {
            setValue("is_recurring", e.target.checked);
            if (!e.target.checked) setValue("recurrence_frequency", null);
          }}
        />
        <Label htmlFor="is_recurring">Recurring income</Label>
      </div>

      {isRecurring && (
        <div className="grid gap-2">
          <Label>Recurrence Frequency</Label>
          <Select
            value={selectedFrequency ?? ""}
            onValueChange={(val) => setValue("recurrence_frequency", val as FormValues["recurrence_frequency"], { shouldValidate: true })}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select frequency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurrence_frequency && <p className="text-xs text-destructive">{errors.recurrence_frequency.message}</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update" : "Add Income"}
        </Button>
      </div>
    </form>
  );
}
