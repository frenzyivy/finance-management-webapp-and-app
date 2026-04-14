"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  SUBSCRIPTION_CATEGORIES,
  BILLING_CYCLES,
  FUNDED_FROM_OPTIONS,
  SUBSCRIPTION_STATUSES,
} from "@/lib/constants/business-categories";
import type { BusinessSubscription } from "@/types/business";

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
  name: z.string().min(1, { message: "Name is required" }).max(100),
  category: z.enum(
    ["ai_tools", "outreach", "email_marketing", "hosting", "domain", "design", "analytics", "crm", "communication", "development", "storage", "other"],
    { message: "Please select a category" }
  ),
  vendor_url: z.string().max(500).nullable(),
  cost_amount: z.coerce.number({ message: "Cost is required" }).positive({ message: "Cost must be > 0" }),
  cost_currency: z.string().default("INR"),
  billing_cycle: z.enum(["monthly", "quarterly", "yearly"], { message: "Please select a billing cycle" }),
  renewal_day: z.coerce.number().int().min(1).max(31),
  next_renewal_date: z.string().min(1, { message: "Next renewal date is required" }),
  start_date: z.string().min(1, { message: "Start date is required" }),
  status: z.enum(["active", "paused", "cancelled", "trial"]),
  trial_ends_date: z.string().nullable(),
  auto_renew: z.boolean(),
  funded_from: z.enum(["personal_pocket", "business_revenue", "mixed"]),
  is_essential: z.boolean(),
  reminder_days_before: z.coerce.number().int().min(0).max(30),
  notes: z.string().max(500).nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface BusinessSubscriptionFormProps {
  entry?: BusinessSubscription;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BusinessSubscriptionForm({ entry, onSuccess, onCancel }: BusinessSubscriptionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!entry;

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: entry?.name ?? "",
      category: entry?.category ?? undefined,
      vendor_url: entry?.vendor_url ?? null,
      cost_amount: entry?.cost_amount ?? (undefined as unknown as number),
      cost_currency: entry?.cost_currency ?? "INR",
      billing_cycle: entry?.billing_cycle ?? undefined,
      renewal_day: entry?.renewal_day ?? 1,
      next_renewal_date: entry?.next_renewal_date ?? "",
      start_date: entry?.start_date ?? new Date().toISOString().split("T")[0],
      status: entry?.status ?? "active",
      trial_ends_date: entry?.trial_ends_date ?? null,
      auto_renew: entry?.auto_renew ?? true,
      funded_from: entry?.funded_from ?? "personal_pocket",
      is_essential: entry?.is_essential ?? true,
      reminder_days_before: entry?.reminder_days_before ?? 3,
      notes: entry?.notes ?? null,
    },
  });

  const selectedCategory = watch("category");
  const selectedBillingCycle = watch("billing_cycle");
  const selectedStatus = watch("status");
  const fundedFrom = watch("funded_from");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // monthly_equivalent is GENERATED — exclude from payload
      const payload = {
        name: values.name,
        category: values.category,
        vendor_url: values.vendor_url || null,
        cost_amount: values.cost_amount,
        cost_currency: values.cost_currency,
        billing_cycle: values.billing_cycle,
        renewal_day: values.renewal_day,
        next_renewal_date: values.next_renewal_date,
        start_date: values.start_date,
        status: values.status,
        trial_ends_date: values.trial_ends_date || null,
        auto_renew: values.auto_renew,
        funded_from: values.funded_from,
        is_essential: values.is_essential,
        reminder_days_before: values.reminder_days_before,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("business_subscriptions").update(payload).eq("id", entry.id);
        if (error) throw error;
        toast.success("Subscription updated");
      } else {
        const { error } = await supabase.from("business_subscriptions").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("Subscription added");
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
      <div className="grid gap-2">
        <Label htmlFor="name">Tool / Service Name</Label>
        <Input id="name" placeholder="e.g. Instantly.ai, Claude Max" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={selectedCategory ?? ""} onValueChange={(val) => setValue("category", val as FormValues["category"], { shouldValidate: true })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vendor_url">Website URL (optional)</Label>
          <Input id="vendor_url" placeholder="https://..." {...register("vendor_url")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="cost_amount">Cost</Label>
          <Input id="cost_amount" type="number" step="0.01" placeholder="0.00" {...register("cost_amount")} />
          {errors.cost_amount && <p className="text-xs text-destructive">{errors.cost_amount.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label>Billing Cycle</Label>
          <Select value={selectedBillingCycle ?? ""} onValueChange={(val) => setValue("billing_cycle", val as FormValues["billing_cycle"], { shouldValidate: true })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select cycle" /></SelectTrigger>
            <SelectContent>
              {BILLING_CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.billing_cycle && <p className="text-xs text-destructive">{errors.billing_cycle.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="renewal_day">Renewal Day</Label>
          <Input id="renewal_day" type="number" min={1} max={31} {...register("renewal_day")} />
          {errors.renewal_day && <p className="text-xs text-destructive">{errors.renewal_day.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="next_renewal_date">Next Renewal Date</Label>
          <Input id="next_renewal_date" type="date" {...register("next_renewal_date")} />
          {errors.next_renewal_date && <p className="text-xs text-destructive">{errors.next_renewal_date.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="start_date">Started On</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={selectedStatus} onValueChange={(val) => setValue("status", val as FormValues["status"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Funded From</Label>
          <Select value={fundedFrom} onValueChange={(val) => setValue("funded_from", val as FormValues["funded_from"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUNDED_FROM_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <input id="is_essential" type="checkbox" className="size-4 rounded border-input accent-primary" {...register("is_essential")} />
          <Label htmlFor="is_essential">Essential tool</Label>
        </div>
        <div className="flex items-center gap-2">
          <input id="auto_renew" type="checkbox" className="size-4 rounded border-input accent-primary" {...register("auto_renew")} />
          <Label htmlFor="auto_renew">Auto-renew</Label>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="reminder_days_before">Remind (days before)</Label>
          <Input id="reminder_days_before" type="number" min={0} max={30} {...register("reminder_days_before")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea id="notes" rows={2} placeholder="e.g. Growth plan, 5000 leads/month" className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update" : "Add Subscription"}
        </Button>
      </div>
    </form>
  );
}
