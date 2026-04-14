"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PAYMENT_METHODS } from "@/lib/constants/categories";
import type { BnplPayment } from "@/types/bnpl";

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

const paymentFormSchema = z.object({
  paid_date: z.string().min(1, { error: "Payment date is required" }),
  payment_method: z.string().min(1, { error: "Please select a payment method" }),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface BnplPaymentFormProps {
  payment: BnplPayment;
  itemName: string;
  platformName: string;
  onSubmit: (
    paymentId: string,
    paidDate: string,
    paymentMethod: string,
    notes?: string
  ) => Promise<{ error: unknown; data: unknown }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BnplPaymentForm({
  payment,
  itemName,
  platformName,
  onSubmit,
  onSuccess,
  onCancel,
}: BnplPaymentFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paymentFormSchema) as any,
    defaultValues: {
      paid_date: new Date().toISOString().split("T")[0],
      payment_method: "upi",
      notes: "",
    },
  });

  const selectedMethod = watch("payment_method");

  const handleFormSubmit = async (values: PaymentFormValues) => {
    setSubmitting(true);
    try {
      const { error, data } = await onSubmit(
        payment.id,
        values.paid_date,
        values.payment_method,
        values.notes || undefined
      );

      if (error) throw error;

      const result = data as { is_fully_paid?: boolean } | null;
      if (result?.is_fully_paid) {
        toast.success(`${itemName} is fully paid off!`);
      } else {
        toast.success("EMI payment recorded");
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4">
      {/* Payment context */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-sm font-medium">{itemName}</p>
        <p className="text-xs text-muted-foreground">{platformName}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm">
            EMI {payment.emi_number} | {formatCurrency(payment.amount)}
          </span>
          <span className="text-xs text-muted-foreground">
            Due {formatDate(payment.due_date)}
          </span>
        </div>
      </div>

      {/* Payment Date */}
      <div className="grid gap-2">
        <Label htmlFor="paid_date">Payment Date</Label>
        <Input id="paid_date" type="date" {...register("paid_date")} />
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
        <Label htmlFor="payment_notes">Notes (optional)</Label>
        <Input
          id="payment_notes"
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
          Confirm Payment
        </Button>
      </div>
    </form>
  );
}
