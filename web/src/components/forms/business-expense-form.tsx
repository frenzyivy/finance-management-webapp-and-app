"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  BUSINESS_EXPENSE_SUBCATEGORIES,
  FUNDED_FROM_OPTIONS,
} from "@/lib/constants/business-categories";
import { PAYMENT_METHODS } from "@/lib/constants/categories";
import type { BusinessExpense, BusinessClient, BusinessSubscription } from "@/types/business";

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
    amount: z.coerce.number({ message: "Amount must be a number" }).positive({ message: "Amount must be > 0" }),
    category: z.enum(
      ["saas_tools", "marketing_ads", "contractor_freelancer", "hardware_equipment", "learning_courses", "travel_meetings", "communication", "domain_hosting", "office_supplies", "taxes_compliance", "miscellaneous"],
      { message: "Please select a category" }
    ),
    sub_category: z.string().max(100).nullable(),
    vendor_name: z.string().min(1, { message: "Vendor name is required" }).max(100),
    subscription_id: z.string().nullable(),
    client_id: z.string().nullable(),
    date: z.string().min(1, { message: "Date is required" }),
    payment_method: z.string().nullable(),
    funded_from: z.enum(["personal_pocket", "business_revenue", "mixed"]),
    personal_portion: z.coerce.number().min(0).nullable(),
    is_tax_deductible: z.boolean(),
    gst_applicable: z.boolean(),
    gst_amount: z.coerce.number().min(0).nullable(),
    is_recurring: z.boolean(),
    recurrence_frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable(),
    receipt_url: z.string().max(500).nullable(),
    notes: z.string().max(500).nullable(),
  })
  .refine(
    (data) => !(data.is_recurring && !data.recurrence_frequency),
    { message: "Recurrence frequency is required", path: ["recurrence_frequency"] }
  );

type FormValues = z.infer<typeof formSchema>;

interface BusinessExpenseFormProps {
  entry?: BusinessExpense;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BusinessExpenseForm({ entry, onSuccess, onCancel }: BusinessExpenseFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [subscriptions, setSubscriptions] = useState<BusinessSubscription[]>([]);
  const isEditing = !!entry;

  useEffect(() => {
    async function fetchRelated() {
      const supabase = createClient();
      const [clientRes, subRes] = await Promise.all([
        supabase.from("business_clients").select("*").eq("status", "active").order("name"),
        supabase.from("business_subscriptions").select("*").eq("status", "active").order("name"),
      ]);
      if (clientRes.data) setClients(clientRes.data);
      if (subRes.data) setSubscriptions(subRes.data);
    }
    fetchRelated();
  }, []);

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      amount: entry?.amount ?? (undefined as unknown as number),
      category: entry?.category ?? undefined,
      sub_category: entry?.sub_category ?? null,
      vendor_name: entry?.vendor_name ?? "",
      subscription_id: entry?.subscription_id ?? null,
      client_id: entry?.client_id ?? null,
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      payment_method: entry?.payment_method ?? null,
      funded_from: entry?.funded_from ?? "personal_pocket",
      personal_portion: entry?.personal_portion ?? null,
      is_tax_deductible: entry?.is_tax_deductible ?? true,
      gst_applicable: entry?.gst_applicable ?? false,
      gst_amount: entry?.gst_amount ?? null,
      is_recurring: entry?.is_recurring ?? false,
      recurrence_frequency: (entry?.recurrence_frequency as FormValues["recurrence_frequency"]) ?? null,
      receipt_url: entry?.receipt_url ?? null,
      notes: entry?.notes ?? null,
    },
  });

  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const fundedFrom = watch("funded_from");
  const gstApplicable = watch("gst_applicable");
  const isRecurring = watch("is_recurring");
  const selectedFrequency = watch("recurrence_frequency");
  const selectedSubId = watch("subscription_id");
  const selectedClientId = watch("client_id");
  const vendorName = watch("vendor_name");

  const subcategories = selectedCategory ? BUSINESS_EXPENSE_SUBCATEGORIES[selectedCategory] || [] : [];

  // Track whether the current subscription_id was set automatically (so we
  // can show the "auto-linked" hint and avoid overwriting a manual selection).
  const [autoLinkedFromVendor, setAutoLinkedFromVendor] = useState(false);

  // Debounced auto-suggest: when vendor_name changes and no subscription is
  // selected (or the current selection was itself an auto-link), call the
  // shared match_business_subscription_by_name RPC and preselect the match.
  useEffect(() => {
    if (isEditing) return;
    const name = (vendorName ?? "").trim();
    if (name.length < 3) return;
    if (selectedSubId && !autoLinkedFromVendor) return;

    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("match_business_subscription_by_name", {
        p_user_id: user.id,
        p_payee_name: name,
      });
      if (error) return;
      const matchedId = (data as string | null) ?? null;
      if (matchedId) {
        setValue("subscription_id", matchedId);
        setAutoLinkedFromVendor(true);
      } else if (autoLinkedFromVendor) {
        setValue("subscription_id", null);
        setAutoLinkedFromVendor(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [vendorName, selectedSubId, autoLinkedFromVendor, isEditing, setValue]);

  const autoLinkedSubscription = autoLinkedFromVendor
    ? subscriptions.find((s) => s.id === selectedSubId)
    : undefined;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        amount: values.amount,
        category: values.category,
        sub_category: values.sub_category || null,
        vendor_name: values.vendor_name,
        subscription_id: values.subscription_id || null,
        client_id: values.client_id || null,
        date: values.date,
        payment_method: values.payment_method || null,
        funded_from: values.funded_from,
        personal_portion: values.funded_from === "mixed" ? (values.personal_portion || 0) : 0,
        is_tax_deductible: values.is_tax_deductible,
        gst_applicable: values.gst_applicable,
        gst_amount: values.gst_applicable ? (values.gst_amount || 0) : 0,
        is_recurring: values.is_recurring,
        recurrence_frequency: values.is_recurring ? values.recurrence_frequency : null,
        receipt_url: values.receipt_url || null,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("business_expenses").update(payload).eq("id", entry.id);
        if (error) throw error;
        toast.success("Business expense updated");
      } else {
        const { error } = await supabase.from("business_expenses").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("Business expense added");
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
        <Label htmlFor="vendor_name">Vendor Name</Label>
        <Input id="vendor_name" placeholder="e.g. Instantly.ai, AWS" {...register("vendor_name")} />
        {errors.vendor_name && <p className="text-xs text-destructive">{errors.vendor_name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={selectedCategory ?? ""} onValueChange={(val) => { setValue("category", val as FormValues["category"], { shouldValidate: true }); setValue("sub_category", null); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {BUSINESS_EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label>Sub-category (optional)</Label>
          {subcategories.length > 0 ? (
            <Select value={watch("sub_category") ?? ""} onValueChange={(val) => setValue("sub_category", val)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select sub-category" /></SelectTrigger>
              <SelectContent>
                {subcategories.map((sc) => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="e.g. AI Tools" {...register("sub_category")} />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Link to Subscription (optional)</Label>
          <Select
            value={selectedSubId ?? ""}
            onValueChange={(val) => {
              setValue("subscription_id", val || null);
              setAutoLinkedFromVendor(false);
            }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select subscription" /></SelectTrigger>
            <SelectContent>
              {subscriptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {autoLinkedSubscription && (
            <p className="text-xs text-muted-foreground">
              Auto-linked to <span className="font-medium">{autoLinkedSubscription.name}</span> by vendor match — change if wrong.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Attributable to Client (optional)</Label>
          <Select value={selectedClientId ?? ""} onValueChange={(val) => setValue("client_id", val || null)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select value={selectedPaymentMethod ?? ""} onValueChange={(val) => setValue("payment_method", val)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select method" /></SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Funded From</Label>
        <div className="flex flex-wrap gap-3">
          {FUNDED_FROM_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" name="funded_from" value={opt.value} checked={fundedFrom === opt.value} onChange={() => setValue("funded_from", opt.value as FormValues["funded_from"])} className="accent-primary" />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {fundedFrom === "mixed" && (
        <div className="grid gap-2">
          <Label htmlFor="personal_portion">Personal Portion (amount from your pocket)</Label>
          <Input id="personal_portion" type="number" step="0.01" placeholder="0.00" {...register("personal_portion")} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input id="is_tax_deductible" type="checkbox" className="size-4 rounded border-input accent-primary" {...register("is_tax_deductible")} />
          <Label htmlFor="is_tax_deductible">Tax deductible</Label>
        </div>
        <div className="flex items-center gap-2">
          <input id="gst_applicable" type="checkbox" className="size-4 rounded border-input accent-primary" checked={gstApplicable} onChange={(e) => { setValue("gst_applicable", e.target.checked); if (!e.target.checked) setValue("gst_amount", null); }} />
          <Label htmlFor="gst_applicable">GST applicable</Label>
        </div>
      </div>

      {gstApplicable && (
        <div className="grid gap-2">
          <Label htmlFor="gst_amount">GST Amount</Label>
          <Input id="gst_amount" type="number" step="0.01" placeholder="0.00" {...register("gst_amount")} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input id="is_recurring" type="checkbox" className="size-4 rounded border-input accent-primary" checked={isRecurring} onChange={(e) => { setValue("is_recurring", e.target.checked); if (!e.target.checked) setValue("recurrence_frequency", null); }} />
        <Label htmlFor="is_recurring">Recurring expense</Label>
      </div>

      {isRecurring && (
        <div className="grid gap-2">
          <Label>Recurrence Frequency</Label>
          <Select value={selectedFrequency ?? ""} onValueChange={(val) => setValue("recurrence_frequency", val as FormValues["recurrence_frequency"], { shouldValidate: true })}>
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
        <textarea id="notes" rows={3} placeholder="Any additional details..." className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update" : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}
