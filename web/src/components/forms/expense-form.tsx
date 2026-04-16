"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  FUNDING_SOURCES,
  BUSINESS_EXPENSE_CATEGORIES,
} from "@/lib/constants/categories";
import type { ExpenseEntry, Debt } from "@/types/database";
import type { BusinessClient } from "@/types/business";
import type { BnplPlatform, BnplPurchase } from "@/types/bnpl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
        "debt_repayment",
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
    funding_source: z.enum(["own_funds", "debt_funded", "debt_repayment"]),
    linked_debt_id: z.string().nullable(),
    source_bnpl_purchase_id: z.string().nullable(),
    is_emi: z.boolean(),
    is_recurring: z.boolean(),
    recurrence_frequency: z
      .enum(["weekly", "monthly", "quarterly", "yearly"])
      .nullable(),
    notes: z.string().max(500).nullable(),
    is_business_investment: z.boolean(),
    biz_category: z
      .enum([
        "saas_tools",
        "marketing_ads",
        "contractor_freelancer",
        "hardware_equipment",
        "learning_courses",
        "travel_meetings",
        "communication",
        "domain_hosting",
        "office_supplies",
        "taxes_compliance",
        "miscellaneous",
      ])
      .nullable(),
    biz_vendor_name: z.string().max(100).nullable(),
    biz_client_id: z.string().nullable(),
    biz_subscription_id: z.string().nullable(),
    biz_reason: z.string().max(200).nullable(),
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
  )
  .refine(
    (data) => {
      if (data.funding_source === "own_funds") return true;
      // Either a debt OR a BNPL purchase must be picked
      return !!data.linked_debt_id || !!data.source_bnpl_purchase_id;
    },
    {
      message: "Please select a debt or BNPL purchase",
      path: ["linked_debt_id"],
    }
  )
  .refine(
    (data) => {
      if (data.is_business_investment && !data.biz_category) return false;
      return true;
    },
    {
      message: "Please pick a business category",
      path: ["biz_category"],
    }
  )
  .refine(
    (data) => {
      if (data.is_business_investment && (!data.biz_vendor_name || data.biz_vendor_name.trim().length === 0)) return false;
      return true;
    },
    {
      message: "Vendor name is required for business expenses",
      path: ["biz_vendor_name"],
    }
  );

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  entry?: ExpenseEntry;
  activeDebts?: Debt[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ entry, activeDebts: activeDebtsProp, onSuccess, onCancel }: ExpenseFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [activeDebts, setActiveDebts] = useState<Debt[]>(activeDebtsProp ?? []);
  const [bnplPlatforms, setBnplPlatforms] = useState<BnplPlatform[]>([]);
  const [bnplPurchases, setBnplPurchases] = useState<BnplPurchase[]>([]);
  const [businessClients, setBusinessClients] = useState<BusinessClient[]>([]);
  const [matchedSubscription, setMatchedSubscription] = useState<{ id: string; name: string } | null>(null);
  const isEditing = !!entry;
  const wasBusinessOnLoad = entry?.is_business_investment ?? false;

  // Fetch active debts if not passed as prop
  useEffect(() => {
    if (activeDebtsProp) return;
    async function fetchDebts() {
      const supabase = createClient();
      const { data } = await supabase
        .from("debts")
        .select("*")
        .eq("status", "active")
        .order("creditor_name");
      if (data) setActiveDebts(data as Debt[]);
    }
    fetchDebts();
  }, [activeDebtsProp]);

  // Fetch BNPL platforms + active purchases so the debt picker can show them too.
  useEffect(() => {
    async function fetchBnpl() {
      const supabase = createClient();
      const [{ data: platforms }, { data: purchases }] = await Promise.all([
        supabase.from("bnpl_platforms").select("*").order("name"),
        supabase
          .from("bnpl_purchases")
          .select("*")
          .in("status", ["active", "overdue"])
          .order("purchase_date", { ascending: false }),
      ]);
      if (platforms) setBnplPlatforms(platforms as BnplPlatform[]);
      if (purchases) setBnplPurchases(purchases as BnplPurchase[]);
    }
    fetchBnpl();
  }, []);

  // Fetch active business clients (for optional link on mirrored expense)
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
    fetchClients();
  }, []);

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
      funding_source: (entry?.funding_source as ExpenseFormValues["funding_source"]) ?? "own_funds",
      linked_debt_id: entry?.linked_debt_id ?? null,
      source_bnpl_purchase_id: entry?.source_bnpl_purchase_id ?? null,
      is_emi: entry?.is_emi ?? false,
      is_recurring: entry?.is_recurring ?? false,
      recurrence_frequency: entry?.recurrence_frequency ?? null,
      notes: entry?.notes ?? null,
      is_business_investment: entry?.is_business_investment ?? false,
      biz_category: null,
      biz_vendor_name: entry?.payee_name ?? null,
      biz_client_id: null,
      biz_subscription_id: null,
      biz_reason: null,
    },
  });

  const isRecurring = watch("is_recurring");
  const isEmi = watch("is_emi");
  const selectedCategory = watch("category");
  const selectedPaymentMethod = watch("payment_method");
  const selectedFrequency = watch("recurrence_frequency");
  const fundingSource = watch("funding_source");
  const linkedDebtId = watch("linked_debt_id");
  const bnplPurchaseId = watch("source_bnpl_purchase_id");
  const isBusinessInvestment = watch("is_business_investment");
  const bizCategory = watch("biz_category");
  const bizClientId = watch("biz_client_id");
  const payeeName = watch("payee_name");

  const selectedDebt = activeDebts.find((d) => d.id === linkedDebtId);
  const selectedBnplPurchase = bnplPurchases.find((p) => p.id === bnplPurchaseId);

  // Auto-match business subscription by payee name (only when business investment is checked)
  useEffect(() => {
    if (!isBusinessInvestment || !payeeName || payeeName.trim().length < 3) {
      setMatchedSubscription(null);
      setValue("biz_subscription_id", null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: matchId, error } = await supabase.rpc("match_business_subscription_by_name", {
        p_user_id: user.id,
        p_payee_name: payeeName,
      });
      if (error || cancelled || !matchId) {
        setMatchedSubscription(null);
        setValue("biz_subscription_id", null);
        return;
      }
      const { data: sub } = await supabase
        .from("business_subscriptions")
        .select("id, name")
        .eq("id", matchId)
        .single();
      if (cancelled) return;
      if (sub) {
        setMatchedSubscription({ id: sub.id, name: sub.name });
        setValue("biz_subscription_id", sub.id);
        // Default category to saas_tools on a subscription match (user can override)
        if (!bizCategory) {
          setValue("biz_category", "saas_tools");
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBusinessInvestment, payeeName]);

  // Force business investment off when funding is debt-linked (out of scope)
  useEffect(() => {
    if (fundingSource !== "own_funds" && isBusinessInvestment) {
      setValue("is_business_investment", false);
    }
  }, [fundingSource, isBusinessInvestment, setValue]);

  const onSubmit = async (values: ExpenseFormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const wantsMirror = values.is_business_investment && values.funding_source === "own_funds";

      // Helper: run mirror (after entry exists)
      const runMirror = async (personalExpenseId: string) => {
        const { error: mirrorErr } = await supabase.rpc("mirror_expense_to_business", {
          p_personal_expense_id: personalExpenseId,
          p_biz_category: values.biz_category,
          p_biz_vendor_name: (values.biz_vendor_name || values.payee_name).trim(),
          p_biz_sub_category: values.sub_category || null,
          p_biz_subscription_id: values.biz_subscription_id || null,
          p_biz_client_id: values.biz_client_id || null,
          p_reason: values.biz_reason || "Paid from personal for business",
          p_notes: values.notes || null,
        });
        if (mirrorErr) throw mirrorErr;
      };

      const runUnmirror = async (personalExpenseId: string) => {
        const { error: unmirrorErr } = await supabase.rpc("unmirror_expense_to_business", {
          p_personal_expense_id: personalExpenseId,
        });
        if (unmirrorErr) throw unmirrorErr;
      };

      if (isEditing) {
        // For editing, use direct update (keeping it simple — cascades are handled on delete)
        const payload = {
          amount: values.amount,
          category: values.category,
          sub_category: values.sub_category || null,
          payee_name: values.payee_name,
          date: values.date,
          payment_method: values.payment_method,
          funding_source: values.funding_source,
          linked_debt_id: values.linked_debt_id || null,
          source_bnpl_purchase_id: values.source_bnpl_purchase_id || null,
          is_emi: values.is_emi,
          is_recurring: values.is_recurring,
          recurrence_frequency: values.is_recurring
            ? values.recurrence_frequency
            : null,
          notes: values.notes || null,
        };
        const { error } = await supabase
          .from("expense_entries")
          .update(payload)
          .eq("id", entry.id);
        if (error) throw error;

        // Handle mirror state transitions on edit.
        // Any of these cases requires tearing down an existing mirror first:
        //   was=true  now=false  -> unmirror
        //   was=true  now=true   -> unmirror then re-mirror (propagates changes)
        //   was=false now=true   -> mirror
        if (wasBusinessOnLoad) {
          await runUnmirror(entry.id);
        }
        if (wantsMirror) {
          await runMirror(entry.id);
          toast.success("Expense updated & mirrored to business books");
        } else {
          toast.success("Expense entry updated successfully");
        }
      } else if (values.funding_source !== "own_funds" && values.source_bnpl_purchase_id) {
        // Expense linked to a BNPL purchase — use the BNPL RPC (updates paid_emis + outstanding on repayment)
        const { error } = await supabase.rpc("create_expense_with_bnpl_purchase_link", {
          p_user_id: user.id,
          p_amount: values.amount,
          p_category: values.category,
          p_sub_category: values.sub_category || null,
          p_payee_name: values.payee_name,
          p_date: values.date,
          p_payment_method: values.payment_method,
          p_funding_source: values.funding_source,
          p_bnpl_purchase_id: values.source_bnpl_purchase_id,
          p_is_emi: values.is_emi,
          p_is_recurring: values.is_recurring,
          p_recurrence_frequency: values.is_recurring
            ? values.recurrence_frequency
            : null,
          p_notes: values.notes || null,
        });
        if (error) throw error;

        if (values.funding_source === "debt_repayment") {
          toast.success("EMI payment recorded — purchase updated");
        } else {
          toast.success("Expense added & linked to BNPL purchase");
        }
      } else if (values.funding_source !== "own_funds" && values.linked_debt_id) {
        // Use RPC for debt-linked expense creation (transactional)
        const { error } = await supabase.rpc("create_expense_with_debt_link", {
          p_user_id: user.id,
          p_amount: values.amount,
          p_category: values.category,
          p_sub_category: values.sub_category || null,
          p_payee_name: values.payee_name,
          p_date: values.date,
          p_payment_method: values.payment_method,
          p_funding_source: values.funding_source,
          p_linked_debt_id: values.linked_debt_id,
          p_is_emi: values.is_emi,
          p_is_recurring: values.is_recurring,
          p_recurrence_frequency: values.is_recurring
            ? values.recurrence_frequency
            : null,
          p_notes: values.notes || null,
        });
        if (error) throw error;

        if (values.funding_source === "debt_repayment") {
          toast.success("Expense added & debt payment recorded automatically");
        } else {
          toast.success("Expense added & linked to debt");
        }
      } else {
        // Regular expense — direct insert
        const payload = {
          user_id: user.id,
          amount: values.amount,
          category: values.category,
          sub_category: values.sub_category || null,
          payee_name: values.payee_name,
          date: values.date,
          payment_method: values.payment_method,
          funding_source: values.funding_source,
          is_emi: values.is_emi,
          is_recurring: values.is_recurring,
          recurrence_frequency: values.is_recurring
            ? values.recurrence_frequency
            : null,
          notes: values.notes || null,
        };
        const { data: inserted, error } = await supabase
          .from("expense_entries")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        if (wantsMirror && inserted) {
          await runMirror(inserted.id);
          toast.success("Expense added & mirrored to business books");
        } else {
          toast.success("Expense entry added successfully");
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

      {/* Row 5: Funding Source */}
      <div className="grid gap-2">
        <Label>Funding Source</Label>
        <div className="flex flex-wrap gap-3">
          {FUNDING_SOURCES.map((fs) => (
            <label key={fs.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="funding_source"
                value={fs.value}
                checked={fundingSource === fs.value}
                onChange={() => {
                  setValue("funding_source", fs.value as ExpenseFormValues["funding_source"], { shouldValidate: true });
                  if (fs.value === "own_funds") {
                    setValue("linked_debt_id", null);
                  }
                  if (fs.value === "debt_repayment") {
                    setValue("category", "debt_repayment", { shouldValidate: true });
                  }
                }}
                className="accent-primary"
              />
              {fs.label}
            </label>
          ))}
        </div>
      </div>

      {/* Conditional: Debt / BNPL purchase selector */}
      {fundingSource !== "own_funds" && (
        <div className="grid gap-2">
          <Label>Select Debt or BNPL Purchase</Label>
          {activeDebts.length === 0 && bnplPurchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active debts or BNPL purchases found.</p>
          ) : (
            <Select
              value={
                bnplPurchaseId
                  ? `bnpl:${bnplPurchaseId}`
                  : linkedDebtId
                  ? `debt:${linkedDebtId}`
                  : ""
              }
              onValueChange={(val) => {
                if (!val) return;
                if (val.startsWith("bnpl:")) {
                  setValue("source_bnpl_purchase_id", val.slice(5), { shouldValidate: true });
                  setValue("linked_debt_id", null, { shouldValidate: true });
                } else if (val.startsWith("debt:")) {
                  setValue("linked_debt_id", val.slice(5), { shouldValidate: true });
                  setValue("source_bnpl_purchase_id", null, { shouldValidate: true });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a debt or purchase" />
              </SelectTrigger>
              <SelectContent>
                {activeDebts.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Debts</SelectLabel>
                    {activeDebts.map((debt) => {
                      const unallocated = debt.original_amount - (debt.allocated_amount ?? 0);
                      return (
                        <SelectItem key={debt.id} value={`debt:${debt.id}`}>
                          {debt.creditor_name} — {debt.name}
                          {fundingSource === "debt_funded" && ` (${formatCurrency(unallocated)} unallocated)`}
                          {fundingSource === "debt_repayment" && ` (${formatCurrency(debt.outstanding_balance)} outstanding)`}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}
                {bnplPlatforms.map((platform) => {
                  const purchasesForPlatform = bnplPurchases.filter(
                    (p) => p.platform_id === platform.id
                  );
                  if (purchasesForPlatform.length === 0) return null;
                  return (
                    <SelectGroup key={platform.id}>
                      <SelectLabel>{platform.name}</SelectLabel>
                      {purchasesForPlatform.map((purchase) => (
                        <SelectItem key={purchase.id} value={`bnpl:${purchase.id}`}>
                          {purchase.item_name}
                          {fundingSource === "debt_repayment" &&
                            ` (EMI ${formatCurrency(purchase.emi_amount)} · ${purchase.paid_emis}/${purchase.total_emis})`}
                          {fundingSource === "debt_funded" &&
                            ` (${formatCurrency(purchase.outstanding_balance)} outstanding)`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {errors.linked_debt_id && (
            <p className="text-xs text-destructive">{errors.linked_debt_id.message}</p>
          )}
          {selectedDebt && fundingSource === "debt_repayment" && selectedDebt.emi_amount && (
            <p className="text-xs text-muted-foreground">
              EMI amount: {formatCurrency(selectedDebt.emi_amount)}
            </p>
          )}
          {selectedBnplPurchase && fundingSource === "debt_repayment" && (
            <p className="text-xs text-muted-foreground">
              EMI amount: {formatCurrency(selectedBnplPurchase.emi_amount)} · paid{" "}
              {selectedBnplPurchase.paid_emis}/{selectedBnplPurchase.total_emis}
            </p>
          )}
        </div>
      )}

      {/* Business Investment block (own_funds only) */}
      {fundingSource === "own_funds" && (
        <div className="grid gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              id="is_business_investment"
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={isBusinessInvestment}
              onChange={(e) => {
                setValue("is_business_investment", e.target.checked, { shouldValidate: true });
                if (!e.target.checked) {
                  setValue("biz_category", null);
                  setValue("biz_subscription_id", null);
                  setValue("biz_client_id", null);
                  setMatchedSubscription(null);
                }
              }}
            />
            <Label htmlFor="is_business_investment" className="font-medium">
              Paid from my pocket for the business
            </Label>
          </div>

          {isBusinessInvestment && (
            <div className="grid gap-3 pl-6">
              {matchedSubscription && (
                <p className="text-xs text-primary">
                  Matched to subscription: <strong>{matchedSubscription.name}</strong> — will link automatically
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Business Category</Label>
                  <Select
                    value={bizCategory ?? ""}
                    onValueChange={(val) =>
                      setValue("biz_category", val as ExpenseFormValues["biz_category"], { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select business category" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_EXPENSE_CATEGORIES.map((cat) => (
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

                <div className="grid gap-2">
                  <Label htmlFor="biz_vendor_name">Vendor Name</Label>
                  <Input
                    id="biz_vendor_name"
                    placeholder="e.g. Claude.ai, AWS"
                    {...register("biz_vendor_name")}
                  />
                  {errors.biz_vendor_name && (
                    <p className="text-xs text-destructive">{errors.biz_vendor_name.message}</p>
                  )}
                </div>
              </div>

              {businessClients.length > 0 && (
                <div className="grid gap-2">
                  <Label>Link to Client (optional)</Label>
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

              <div className="grid gap-2">
                <Label htmlFor="biz_reason">Reason (optional)</Label>
                <Input
                  id="biz_reason"
                  placeholder="e.g. AI tooling for client work"
                  {...register("biz_reason")}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-generated warning for editing */}
      {isEditing && entry?.is_auto_generated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>This expense was auto-generated from a debt. Editing it may desync linked records.</span>
        </div>
      )}

      {/* Row 6: Checkboxes */}
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
