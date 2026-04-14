"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Calculator, Sparkles, FileText, CheckCircle2, AlertCircle } from "lucide-react";

import { formatCurrency } from "@/lib/utils/currency";
import {
  BNPL_PURCHASE_CATEGORIES,
} from "@/lib/constants/categories";
import type { BnplPlatformWithStats, BnplInterestRateType } from "@/types/bnpl";
import { InvoiceUploadDialog } from "@/components/bnpl/invoice-upload-dialog";
import type { ParsedInvoiceData } from "@/hooks/use-bnpl-parser";

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

const purchaseFormSchema = z.object({
  platform_id: z.string().min(1, { error: "Please select a platform" }),
  item_name: z.string().min(1, { error: "Item name is required" }).max(200),
  item_category: z.string().min(1, { error: "Please select a category" }),
  order_id: z.string().max(100).optional().or(z.literal("")),
  merchant_name: z.string().max(100).optional().or(z.literal("")),
  total_amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive({ error: "Amount must be greater than 0" }),
  down_payment: z.coerce
    .number({ error: "Must be a number" })
    .min(0, { error: "Cannot be negative" })
    .optional()
    .or(z.literal("")),
  interest_rate: z.coerce
    .number({ error: "Must be a number" })
    .min(0, { error: "Cannot be negative" })
    .optional()
    .or(z.literal("")),
  interest_rate_type: z.enum(["per_annum", "flat"]).default("per_annum"),
  processing_fee: z.coerce
    .number({ error: "Must be a number" })
    .min(0, { error: "Cannot be negative" })
    .optional()
    .or(z.literal("")),
  total_emis: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .min(1, { error: "At least 1 EMI required" }),
  emi_day_of_month: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .min(1, { error: "Day must be 1-31" })
    .max(31, { error: "Day must be 1-31" }),
  purchase_date: z.string().min(1, { error: "Purchase date is required" }),
  first_emi_date: z.string().min(1, { error: "First EMI date is required" }),
  is_business_purchase: z.boolean().optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface BnplPurchaseFormProps {
  platforms: BnplPlatformWithStats[];
  preselectedPlatformId?: string;
  /** If true, open the invoice upload dialog immediately on mount. */
  autoOpenUpload?: boolean;
  /** Called when the user uploads and parses invoice files. Parent should stash the files to upload after purchase creation. */
  onInvoicesSelected?: (orderFile: File, emiFile: File | null) => void;
  onSubmit: (params: {
    platform_id: string;
    item_name: string;
    item_category: string;
    order_id?: string;
    merchant_name?: string;
    total_amount: number;
    down_payment: number;
    interest_rate: number;
    interest_rate_type: BnplInterestRateType;
    processing_fee: number;
    total_payable: number;
    emi_amount: number;
    total_emis: number;
    purchase_date: string;
    first_emi_date: string;
    emi_day_of_month: number;
    is_business_purchase?: boolean;
    notes?: string;
  }) => Promise<{ error: unknown }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BnplPurchaseForm({
  platforms,
  preselectedPlatformId,
  autoOpenUpload,
  onInvoicesSelected,
  onSubmit,
  onSuccess,
  onCancel,
}: BnplPurchaseFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(!!autoOpenUpload);
  const [parsedWarnings, setParsedWarnings] = useState<string[]>([]);
  const [parsedFileNames, setParsedFileNames] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(purchaseFormSchema) as any,
    defaultValues: {
      platform_id: preselectedPlatformId ?? "",
      item_name: "",
      item_category: undefined,
      order_id: "",
      merchant_name: "",
      total_amount: undefined as unknown as number,
      down_payment: 0,
      interest_rate: 0,
      interest_rate_type: "per_annum" as BnplInterestRateType,
      processing_fee: 0,
      total_emis: undefined as unknown as number,
      emi_day_of_month: undefined as unknown as number,
      purchase_date: new Date().toISOString().split("T")[0],
      first_emi_date: "",
      is_business_purchase: false,
      notes: "",
    },
  });

  const selectedPlatform = watch("platform_id");
  const selectedCategory = watch("item_category");
  const selectedRateType = watch("interest_rate_type");

  // Live EMI calculation
  const totalAmount = watch("total_amount");
  const downPayment = watch("down_payment");
  const interestRate = watch("interest_rate");
  const interestRateType = watch("interest_rate_type");
  const processingFee = watch("processing_fee");
  const totalEmis = watch("total_emis");

  const emiCalc = useMemo(() => {
    const amount = Number(totalAmount) || 0;
    const dp = Number(downPayment) || 0;
    const rate = Number(interestRate) || 0;
    const fee = Number(processingFee) || 0;
    const emis = Number(totalEmis) || 1;

    const financed = Math.max(0, amount - dp);

    let emiAmount: number;
    let totalInterest: number;

    if (interestRateType === "per_annum") {
      // Reducing balance (standard amortising loan EMI):
      // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
      const r = rate / 100 / 12;
      if (r === 0 || emis <= 0) {
        emiAmount = emis > 0 ? financed / emis : 0;
        totalInterest = 0;
      } else {
        const pow = Math.pow(1 + r, emis);
        emiAmount = (financed * r * pow) / (pow - 1);
        totalInterest = emiAmount * emis - financed;
      }
    } else {
      // Flat rate: total interest = financed × rate / 100 (over the full tenure)
      totalInterest = (financed * rate) / 100;
      emiAmount = emis > 0 ? (financed + totalInterest) / emis : 0;
    }

    emiAmount = Math.round(emiAmount * 100) / 100;
    totalInterest = Math.round(totalInterest * 100) / 100;
    const totalPayable = Math.round((financed + totalInterest + fee) * 100) / 100;

    return {
      financed,
      totalInterest,
      totalPayable,
      emiAmount,
    };
  }, [totalAmount, downPayment, interestRate, interestRateType, processingFee, totalEmis]);

  const applyParsedInvoice = (
    data: ParsedInvoiceData,
    files: { orderFile: File; emiFile: File | null }
  ) => {
    // Pre-fill all form fields with parsed data (only if present)
    if (data.item_name) setValue("item_name", data.item_name, { shouldValidate: true });
    if (data.item_category) setValue("item_category", data.item_category, { shouldValidate: true });
    if (data.order_id) setValue("order_id", data.order_id);
    if (data.merchant_name) setValue("merchant_name", data.merchant_name);
    if (data.total_amount != null) setValue("total_amount", data.total_amount, { shouldValidate: true });
    if (data.down_payment != null) setValue("down_payment", data.down_payment);
    if (data.interest_rate != null) setValue("interest_rate", data.interest_rate);
    if (data.interest_rate_type)
      setValue("interest_rate_type", data.interest_rate_type as BnplInterestRateType);
    if (data.processing_fee != null) setValue("processing_fee", data.processing_fee);
    if (data.total_emis != null) setValue("total_emis", data.total_emis, { shouldValidate: true });
    if (data.purchase_date) setValue("purchase_date", data.purchase_date);
    if (data.first_emi_date) setValue("first_emi_date", data.first_emi_date, { shouldValidate: true });
    if (data.emi_day_of_month != null)
      setValue("emi_day_of_month", data.emi_day_of_month, { shouldValidate: true });
    if (data.notes) setValue("notes", data.notes);

    setParsedWarnings(data.warnings || []);
    const names = [files.orderFile.name];
    if (files.emiFile) names.push(files.emiFile.name);
    setParsedFileNames(names);

    onInvoicesSelected?.(files.orderFile, files.emiFile);
  };

  const handleFormSubmit = async (values: PurchaseFormValues) => {
    setSubmitting(true);
    try {
      const dp = Number(values.down_payment) || 0;
      const rate = Number(values.interest_rate) || 0;
      const fee = Number(values.processing_fee) || 0;

      const { error } = await onSubmit({
        platform_id: values.platform_id,
        item_name: values.item_name,
        item_category: values.item_category,
        order_id: values.order_id || undefined,
        merchant_name: values.merchant_name || undefined,
        total_amount: values.total_amount,
        down_payment: dp,
        interest_rate: rate,
        interest_rate_type: values.interest_rate_type,
        processing_fee: fee,
        total_payable: emiCalc.totalPayable,
        emi_amount: emiCalc.emiAmount,
        total_emis: values.total_emis,
        purchase_date: values.purchase_date,
        first_emi_date: values.first_emi_date,
        emi_day_of_month: values.emi_day_of_month,
        is_business_purchase: values.is_business_purchase,
        notes: values.notes || undefined,
      });

      if (error) throw error;
      toast.success("Purchase added with EMI schedule");
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4">
      {/* Upload invoice to auto-fill */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            <span className="text-sm font-medium">Have an Amazon Pay Later invoice?</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setUploadOpen(true)}
            className="h-7"
          >
            <Sparkles className="size-3" />
            Upload Invoice
          </Button>
        </div>
        {parsedFileNames.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-blue-200/60 pt-2 dark:border-blue-900/40">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-3" />
              <span>Parsed successfully — form pre-filled</span>
            </div>
            {parsedFileNames.map((name) => (
              <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="size-3" />
                <span className="truncate">{name}</span>
              </div>
            ))}
            {parsedWarnings.length > 0 && (
              <div className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 p-2 dark:bg-amber-950/20">
                <AlertCircle className="size-3 mt-0.5 text-amber-600 shrink-0" />
                <div className="text-[11px] text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-0.5">Please verify:</p>
                  <ul className="list-disc ml-3 space-y-0.5">
                    {parsedWarnings.slice(0, 3).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Platform */}
      <div className="grid gap-2">
        <Label>Platform</Label>
        <Select
          value={selectedPlatform ?? ""}
          onValueChange={(val) =>
            val && setValue("platform_id", val, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            {platforms
              .filter((p) => p.status === "active")
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {errors.platform_id && (
          <p className="text-xs text-destructive">
            {errors.platform_id.message}
          </p>
        )}
      </div>

      {/* Item Name + Category */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="item_name">Item Name</Label>
          <Input
            id="item_name"
            placeholder="e.g. Samsung Galaxy Buds FE"
            {...register("item_name")}
          />
          {errors.item_name && (
            <p className="text-xs text-destructive">
              {errors.item_name.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Category</Label>
          <Select
            value={selectedCategory ?? ""}
            onValueChange={(val) =>
              val && setValue("item_category", val, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {BNPL_PURCHASE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.item_category && (
            <p className="text-xs text-destructive">
              {errors.item_category.message}
            </p>
          )}
        </div>
      </div>

      {/* Order ID + Merchant (optional) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="order_id">Order ID (optional)</Label>
          <Input
            id="order_id"
            placeholder="e.g. 408-1234567-8901234"
            {...register("order_id")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="merchant_name">Merchant (optional)</Label>
          <Input
            id="merchant_name"
            placeholder="e.g. Amazon"
            {...register("merchant_name")}
          />
        </div>
      </div>

      {/* Purchase Date */}
      <div className="grid gap-2">
        <Label htmlFor="purchase_date">Purchase Date</Label>
        <Input
          id="purchase_date"
          type="date"
          {...register("purchase_date")}
        />
        {errors.purchase_date && (
          <p className="text-xs text-destructive">
            {errors.purchase_date.message}
          </p>
        )}
      </div>

      {/* Financial Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="total_amount">Total Price</Label>
          <Input
            id="total_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("total_amount")}
          />
          {errors.total_amount && (
            <p className="text-xs text-destructive">
              {errors.total_amount.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="down_payment">Down Payment</Label>
          <Input
            id="down_payment"
            type="number"
            step="0.01"
            placeholder="0"
            {...register("down_payment")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input
            id="interest_rate"
            type="number"
            step="0.01"
            placeholder="0 for no-cost EMI"
            {...register("interest_rate")}
          />
        </div>

        <div className="grid gap-2">
          <Label>Rate Type</Label>
          <Select
            value={selectedRateType ?? "per_annum"}
            onValueChange={(val) =>
              val && setValue("interest_rate_type", val as BnplInterestRateType, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_annum">Per Annum</SelectItem>
              <SelectItem value="flat">Flat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="processing_fee">Processing Fee</Label>
          <Input
            id="processing_fee"
            type="number"
            step="0.01"
            placeholder="0"
            {...register("processing_fee")}
          />
        </div>
      </div>

      {/* EMI Details */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="total_emis">Number of EMIs</Label>
          <Input
            id="total_emis"
            type="number"
            min={1}
            placeholder="e.g. 3"
            {...register("total_emis")}
          />
          {errors.total_emis && (
            <p className="text-xs text-destructive">
              {errors.total_emis.message}
            </p>
          )}
        </div>

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
          <Label htmlFor="first_emi_date">First EMI Date</Label>
          <Input
            id="first_emi_date"
            type="date"
            {...register("first_emi_date")}
          />
          {errors.first_emi_date && (
            <p className="text-xs text-destructive">
              {errors.first_emi_date.message}
            </p>
          )}
        </div>
      </div>

      {/* EMI Calculator preview */}
      {emiCalc.totalPayable > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Calculator className="size-3.5 text-blue-600" />
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
              EMI Breakdown
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-300">Financed: </span>
              <span className="font-medium">{formatCurrency(emiCalc.financed)}</span>
            </div>
            {emiCalc.totalInterest > 0 && (
              <div>
                <span className="text-blue-700 dark:text-blue-300">Interest: </span>
                <span className="font-medium">
                  {formatCurrency(emiCalc.totalInterest)}
                </span>
              </div>
            )}
            <div>
              <span className="text-blue-700 dark:text-blue-300">Total Payable: </span>
              <span className="font-semibold">
                {formatCurrency(emiCalc.totalPayable)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">EMI Amount: </span>
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {formatCurrency(emiCalc.emiAmount)}/mo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Business purchase checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_business_purchase"
          className="size-4 rounded border-input"
          {...register("is_business_purchase")}
        />
        <Label htmlFor="is_business_purchase" className="text-sm font-normal">
          This is a business purchase
        </Label>
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="purchase_notes">Notes (optional)</Label>
        <textarea
          id="purchase_notes"
          rows={2}
          placeholder="e.g. No-cost EMI offer, cashback applied..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Add Purchase
        </Button>
      </div>

      <InvoiceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onParsed={applyParsedInvoice}
      />
    </form>
  );
}
