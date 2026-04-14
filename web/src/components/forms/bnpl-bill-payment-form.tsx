"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { formatCurrency } from "@/lib/utils/currency";
import { PAYMENT_METHODS } from "@/lib/constants/categories";
import type { BnplBill } from "@/types/bnpl";

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

const billPaymentSchema = z.object({
  paid_date: z.string().min(1, { error: "Payment date is required" }),
  payment_method: z.string().min(1, { error: "Please select a payment method" }),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type BillPaymentValues = z.infer<typeof billPaymentSchema>;

function getMonthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

interface BnplBillPaymentFormProps {
  bill: BnplBill;
  platformName: string;
  onSubmit: (
    billId: string,
    paidDate: string,
    paymentMethod: string,
    notes?: string
  ) => Promise<{ error: unknown; data: unknown }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BnplBillPaymentForm({
  bill,
  platformName,
  onSubmit,
  onSuccess,
  onCancel,
}: BnplBillPaymentFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const unpaidAmount = bill.total_amount - bill.paid_amount;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BillPaymentValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(billPaymentSchema) as any,
    defaultValues: {
      paid_date: new Date().toISOString().split("T")[0],
      payment_method: "upi",
      notes: "",
    },
  });

  const selectedMethod = watch("payment_method");

  const handleFormSubmit = async (values: BillPaymentValues) => {
    setSubmitting(true);
    try {
      const { error } = await onSubmit(
        bill.id,
        values.paid_date,
        values.payment_method,
        values.notes || undefined
      );

      if (error) throw error;
      toast.success(
        `${getMonthLabel(bill.bill_month, bill.bill_year)} bill paid`
      );
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
      {/* Bill context */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-sm font-medium">
          {getMonthLabel(bill.bill_month, bill.bill_year)} Bill
        </p>
        <p className="text-xs text-muted-foreground">{platformName}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-semibold">
            {formatCurrency(unpaidAmount)}
          </span>
          <span className="text-xs text-muted-foreground">
            {bill.paid_amount > 0 && (
              <>{formatCurrency(bill.paid_amount)} already paid | </>
            )}
            Total: {formatCurrency(bill.total_amount)}
          </span>
        </div>
      </div>

      {/* Payment Date */}
      <div className="grid gap-2">
        <Label htmlFor="bill_paid_date">Payment Date</Label>
        <Input
          id="bill_paid_date"
          type="date"
          {...register("paid_date")}
        />
        {errors.paid_date && (
          <p className="text-xs text-destructive">
            {errors.paid_date.message}
          </p>
        )}
      </div>

      {/* Payment Method */}
      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select
          value={selectedMethod ?? ""}
          onValueChange={(val) =>
            val && setValue("payment_method", val, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select method" />
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

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="bill_notes">Notes (optional)</Label>
        <Input
          id="bill_notes"
          placeholder="Any additional details..."
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
          Pay {formatCurrency(unpaidAmount)}
        </Button>
      </div>
    </form>
  );
}
