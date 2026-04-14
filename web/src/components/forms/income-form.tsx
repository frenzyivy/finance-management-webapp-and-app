"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCE_TYPES,
  BUSINESS_INCOME_CATEGORIES,
} from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/utils/currency";
import type { IncomeEntry, Debt } from "@/types/database";
import type { BusinessClient } from "@/types/business";

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
    source_type: z.enum(["personal", "client", "borrowed"]),
    // Client-mirror fields
    biz_category: z
      .enum([
        "client_project",
        "retainer",
        "freelance_platform",
        "affiliate_commission",
        "consultation",
        "one_off_gig",
        "refund",
        "other",
      ])
      .nullable(),
    biz_client_id: z.string().nullable(),
    biz_project_name: z.string().max(100).nullable(),
    biz_invoice_number: z.string().max(50).nullable(),
    // Borrowed-money fields
    linked_debt_id: z.string().nullable(),
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
  )
  .refine(
    (data) => {
      if (data.source_type === "client" && !data.biz_category) return false;
      return true;
    },
    {
      message: "Please pick a business income category",
      path: ["biz_category"],
    }
  )
  .refine(
    (data) => {
      if (data.source_type === "borrowed" && !data.linked_debt_id) return false;
      return true;
    },
    {
      message: "Please link to the debt this money came from",
      path: ["linked_debt_id"],
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
  const [businessClients, setBusinessClients] = useState<BusinessClient[]>([]);
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);
  const isEditing = !!entry;
  const wasBusinessOnLoad = entry?.is_business_withdrawal ?? false;

  // Infer initial source type from the existing entry
  const initialSourceType: "personal" | "client" | "borrowed" =
    entry?.is_business_withdrawal
      ? "client"
      : entry?.category === "borrowed"
      ? "borrowed"
      : "personal";

  useEffect(() => {
    async function fetchClients() {
      const supabase = createClient();
      const { data } = await supabase
        .from("business_clients")
        .select("id, user_id, name, industry, country, contact_name, contact_email, contact_phone, engagement_type, monthly_value, start_date, status, notes, created_at, updated_at")
        .eq("status", "active")
        .order("name");
      if (data) setBusinessClients(data as BusinessClient[]);
    }
    async function fetchDebts() {
      const supabase = createClient();
      const { data } = await supabase
        .from("debts")
        .select("*")
        .eq("status", "active")
        .order("creditor_name");
      if (data) setActiveDebts(data as Debt[]);
    }
    fetchClients();
    fetchDebts();
  }, []);

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
      source_type: initialSourceType,
      biz_category: null,
      biz_client_id: null,
      biz_project_name: null,
      biz_invoice_number: null,
      linked_debt_id: entry?.linked_debt_id ?? null,
    },
  });

  const isRecurring = watch("is_recurring");
  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const selectedFrequency = watch("recurrence_frequency");
  const sourceType = watch("source_type");
  const bizCategory = watch("biz_category");
  const bizClientId = watch("biz_client_id");
  const linkedDebtId = watch("linked_debt_id");

  // Keep category in sync with source_type:
  //  - borrowed -> force category='borrowed'
  //  - client   -> default category='freelance' (treat as business-linked freelance)
  useEffect(() => {
    if (sourceType === "borrowed") {
      setValue("category", "borrowed", { shouldValidate: true });
    } else if (sourceType === "client" && selectedCategory === "borrowed") {
      setValue("category", "freelance", { shouldValidate: true });
      setValue("linked_debt_id", null);
    } else if (sourceType === "personal") {
      setValue("linked_debt_id", null);
      setValue("biz_category", null);
      setValue("biz_client_id", null);
    }
  }, [sourceType, selectedCategory, setValue]);

  const onSubmit = async (values: IncomeFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
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
        linked_debt_id: values.source_type === "borrowed" ? values.linked_debt_id : null,
      };

      const wantsMirror = values.source_type === "client";

      const runMirror = async (personalIncomeId: string) => {
        const { error: mirrorErr } = await supabase.rpc("mirror_income_to_business", {
          p_personal_income_id: personalIncomeId,
          p_biz_category: values.biz_category,
          p_biz_source_name: values.source_name,
          p_project_name: values.biz_project_name || null,
          p_client_id: values.biz_client_id || null,
          p_invoice_number: values.biz_invoice_number || null,
          p_reason: "Client revenue landed in personal account",
          p_notes: values.notes || null,
        });
        if (mirrorErr) throw mirrorErr;
      };

      const runUnmirror = async (personalIncomeId: string) => {
        const { error: unmirrorErr } = await supabase.rpc("unmirror_income_to_business", {
          p_personal_income_id: personalIncomeId,
        });
        if (unmirrorErr) throw unmirrorErr;
      };

      if (isEditing) {
        const { error } = await supabase
          .from("income_entries")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;

        if (wasBusinessOnLoad) {
          await runUnmirror(entry.id);
        }
        if (wantsMirror) {
          await runMirror(entry.id);
          toast.success("Income updated & mirrored to business books");
        } else {
          toast.success("Income entry updated successfully");
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("income_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        if (wantsMirror && inserted) {
          await runMirror(inserted.id);
          toast.success("Income added & mirrored to business books");
        } else {
          toast.success("Income entry added successfully");
        }
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

      {/* Source Type */}
      <div className="grid gap-2">
        <Label>Where did this money come from?</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {INCOME_SOURCE_TYPES.map((st) => (
            <label key={st.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="source_type"
                value={st.value}
                checked={sourceType === st.value}
                onChange={() =>
                  setValue("source_type", st.value as IncomeFormValues["source_type"], {
                    shouldValidate: true,
                  })
                }
                className="accent-primary"
              />
              {st.label}
            </label>
          ))}
        </div>
      </div>

      {/* Category (hidden when borrowed — forced to "borrowed") */}
      {sourceType !== "borrowed" && (
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
              {INCOME_CATEGORIES.filter((c) => c.value !== "borrowed").map((cat) => (
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
      )}

      {/* Client-mirror block */}
      {sourceType === "client" && (
        <div className="grid gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            This will also appear in your business books as revenue (landed in personal account).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Business Income Category</Label>
              <Select
                value={bizCategory ?? ""}
                onValueChange={(val) =>
                  setValue("biz_category", val as IncomeFormValues["biz_category"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select business category" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_INCOME_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.biz_category && (
                <p className="text-xs text-destructive">{errors.biz_category.message}</p>
              )}
            </div>

            {businessClients.length > 0 && (
              <div className="grid gap-2">
                <Label>Client (optional)</Label>
                <Select
                  value={bizClientId ?? "__none__"}
                  onValueChange={(val) => setValue("biz_client_id", val === "__none__" ? null : val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No client link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No client link</SelectItem>
                    {businessClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="biz_project_name">Project Name (optional)</Label>
              <Input
                id="biz_project_name"
                placeholder="e.g. Q2 Landing Page Build"
                {...register("biz_project_name")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="biz_invoice_number">Invoice # (optional)</Label>
              <Input
                id="biz_invoice_number"
                placeholder="e.g. INV-2026-042"
                {...register("biz_invoice_number")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Borrowed block — debt link */}
      {sourceType === "borrowed" && (
        <div className="grid gap-2">
          <Label>Link to Debt</Label>
          {activeDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active debts found. Create a debt first so this income can be linked to it.
            </p>
          ) : (
            <Select
              value={linkedDebtId ?? ""}
              onValueChange={(val) => setValue("linked_debt_id", val, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select the debt this money came from" />
              </SelectTrigger>
              <SelectContent>
                {activeDebts.map((debt) => (
                  <SelectItem key={debt.id} value={debt.id}>
                    {debt.creditor_name} — {debt.name} ({formatCurrency(debt.outstanding_balance)} outstanding)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.linked_debt_id && (
            <p className="text-xs text-destructive">{errors.linked_debt_id.message}</p>
          )}
        </div>
      )}

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
