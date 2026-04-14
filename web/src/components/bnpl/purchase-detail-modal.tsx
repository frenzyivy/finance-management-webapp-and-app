"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { BnplPurchase, BnplPayment, BnplPaymentStatus } from "@/types/bnpl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const PAYMENT_STATUS_STYLES: Record<BnplPaymentStatus, string> = {
  upcoming: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  late_paid: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  skipped: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500",
};

const PAYMENT_STATUS_LABELS: Record<BnplPaymentStatus, string> = {
  upcoming: "Upcoming",
  due: "Due",
  paid: "Paid",
  late_paid: "Late",
  overdue: "Overdue",
  skipped: "Skipped",
};

function getEffectiveStatus(payment: BnplPayment): BnplPaymentStatus {
  if (payment.status === "upcoming" && payment.due_date < new Date().toISOString().split("T")[0]) {
    return "overdue";
  }
  return payment.status;
}

interface PurchaseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: BnplPurchase | null;
  platformName: string;
  platformColor: string;
  fetchPayments: (purchaseId: string) => Promise<BnplPayment[]>;
  onPayEMI: (payment: BnplPayment) => void;
  onForeclose: (purchase: BnplPurchase) => void;
}

export function PurchaseDetailModal({
  open,
  onOpenChange,
  purchase,
  platformName,
  platformColor,
  fetchPayments,
  onPayEMI,
  onForeclose,
}: PurchaseDetailModalProps) {
  const [payments, setPayments] = useState<BnplPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (open && purchase) {
      setLoadingPayments(true);
      fetchPayments(purchase.id).then((data) => {
        setPayments(data);
        setLoadingPayments(false);
      });
    }
  }, [open, purchase, fetchPayments]);

  if (!purchase) return null;

  const progressPercent =
    purchase.total_emis > 0
      ? Math.round((purchase.paid_emis / purchase.total_emis) * 100)
      : 0;

  const isActive = purchase.status === "active" || purchase.status === "overdue";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: platformColor }}
            />
            <DialogTitle>{purchase.item_name}</DialogTitle>
          </div>
          <DialogDescription>{platformName}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">
              Details
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1">
              EMI Schedule
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Amount</p>
                <p className="font-medium">
                  {formatCurrency(purchase.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Outstanding</p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(purchase.outstanding_balance)}
                </p>
              </div>
              {purchase.down_payment > 0 && (
                <div>
                  <p className="text-muted-foreground">Down Payment</p>
                  <p className="font-medium">
                    {formatCurrency(purchase.down_payment)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Financed</p>
                <p className="font-medium">
                  {formatCurrency(purchase.financed_amount)}
                </p>
              </div>
              {purchase.interest_rate > 0 && (
                <div>
                  <p className="text-muted-foreground">Interest Rate</p>
                  <p className="font-medium">
                    {purchase.interest_rate}%{" "}
                    <span className="text-xs text-muted-foreground">
                      ({purchase.interest_rate_type === "per_annum" ? "p.a." : "flat"})
                    </span>
                  </p>
                </div>
              )}
              {purchase.processing_fee > 0 && (
                <div>
                  <p className="text-muted-foreground">Processing Fee</p>
                  <p className="font-medium">
                    {formatCurrency(purchase.processing_fee)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Total Payable</p>
                <p className="font-medium">
                  {formatCurrency(purchase.total_payable)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">EMI Amount</p>
                <p className="font-medium">
                  {formatCurrency(purchase.emi_amount)}/mo
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">EMIs</p>
                <p className="font-medium">
                  {purchase.paid_emis} of {purchase.total_emis} paid
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Purchase Date</p>
                <p className="font-medium">
                  {formatDate(purchase.purchase_date)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">First EMI</p>
                <p className="font-medium">
                  {formatDate(purchase.first_emi_date)}
                </p>
              </div>
              {purchase.last_emi_date && (
                <div>
                  <p className="text-muted-foreground">Last EMI</p>
                  <p className="font-medium">
                    {formatDate(purchase.last_emi_date)}
                  </p>
                </div>
              )}
              {purchase.order_id && (
                <div>
                  <p className="text-muted-foreground">Order ID</p>
                  <p className="font-medium font-mono text-xs">
                    {purchase.order_id}
                  </p>
                </div>
              )}
            </div>

            {purchase.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notes</p>
                <p>{purchase.notes}</p>
              </div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <Progress value={progressPercent} />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(purchase.total_payable - purchase.outstanding_balance)} paid of{" "}
                {formatCurrency(purchase.total_payable)} ({progressPercent}%)
              </p>
            </div>

            {/* Foreclose button */}
            {isActive && purchase.outstanding_balance > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Pay off remaining {formatCurrency(purchase.outstanding_balance)}?
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                      Close this purchase by paying the remaining balance at once.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => onForeclose(purchase)}
                    >
                      Foreclose Purchase
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* EMI Schedule Tab */}
          <TabsContent value="schedule" className="space-y-3">
            {loadingPayments ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No EMI schedule generated.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {payments.map((payment) => {
                  const effectiveStatus = getEffectiveStatus(payment);
                  const statusStyle = PAYMENT_STATUS_STYLES[effectiveStatus];
                  const statusLabel = PAYMENT_STATUS_LABELS[effectiveStatus];
                  const canPay =
                    effectiveStatus === "upcoming" ||
                    effectiveStatus === "due" ||
                    effectiveStatus === "overdue";

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs font-mono text-muted-foreground">
                          #{payment.emi_number}
                        </span>
                        <div>
                          <p className="font-medium">
                            {formatCurrency(payment.amount)}
                            {payment.bill_id && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0 text-[9px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                Billed
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(payment.due_date)}
                            {payment.paid_date &&
                              ` | Paid ${formatDate(payment.paid_date)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusStyle}`}
                        >
                          {statusLabel}
                        </span>
                        {canPay && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2"
                            onClick={() => onPayEMI(payment)}
                          >
                            Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
