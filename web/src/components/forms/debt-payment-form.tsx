"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { formatCurrency } from "@/lib/utils/currency";
import { PAYMENT_METHODS } from "@/lib/constants/categories";

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
  amount: z.coerce
    .number({ error: "Amount must be a number" })
    .positive({ error: "Amount must be greater than 0" }),
  date: z.string().min(1, { error: "Date is required" }),
  payment_method: z.enum(
    ["bank_transfer", "upi", "credit_card", "debit_card", "cash", "wallet"],
    { error: "Please select a payment method" }
  ),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface DebtPaymentFormProps {
  debtId: string;
  debtName: string;
  outstandingBalance: number;
  onSubmitPayment: (
    debtId: string,
    amount: number,
    date: string,
    notes?: string,
    paymentMethod?: string
  ) => Promise<{ error: unknown }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DebtPaymentForm({
  debtId,
  debtName,
  outstandingBalance,
  onSubmitPayment,
  onSuccess,
  onCancel,
}: DebtPaymentFormProps) {
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
      amount: undefined as unknown as number,
      date: new Date().toISOString().split("T")[0],
      payment_method: "bank_transfer",
      notes: "",
    },
  });

  const selectedPaymentMethod = watch("payment_method");

  const onSubmit = async (values: PaymentFormValues) => {
    setSubmitting(true);
    try {
      const { error } = await onSubmitPayment(
        debtId,
        values.amount,
        values.date,
        values.notes || undefined,
        values.payment_method
      );
      if (error) {
        const message =
          error instanceof Error ? error.message : "Failed to log payment";
        toast.error(message);
        return;
      }
      toast.success("Payment logged successfully");
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
      {/* Outstanding balance context */}
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <span className="text-muted-foreground">Outstanding balance for </span>
        <span className="font-medium">{debtName}</span>
        <span className="text-muted-foreground">: </span>
        <span className="font-semibold text-red-600 dark:text-red-400">
          {formatCurrency(outstandingBalance)}
        </span>
      </div>

      {/* Amount + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="payment-amount">Payment Amount</Label>
          <Input
            id="payment-amount"
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
          <Label htmlFor="payment-date">Date</Label>
          <Input id="payment-date" type="date" {...register("date")} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      {/* Payment Method */}
      <div className="grid gap-2">
        <Label>Payment Method</Label>
        <Select
          value={selectedPaymentMethod ?? "bank_transfer"}
          onValueChange={(val) =>
            setValue("payment_method", val as PaymentFormValues["payment_method"], {
              shouldValidate: true,
            })
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
          <p className="text-xs text-destructive">{errors.payment_method.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="payment-notes">Notes (optional)</Label>
        <Input
          id="payment-notes"
          placeholder="e.g. Partial payment, bonus payout"
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
          Log Payment
        </Button>
      </div>
    </form>
  );
}
