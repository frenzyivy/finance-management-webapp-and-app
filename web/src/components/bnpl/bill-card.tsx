"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, IndianRupee, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type {
  BnplBill,
  BnplBillWithPayments,
  BnplBillStatus,
  BnplPaymentStatus,
} from "@/types/bnpl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const BILL_STATUS_STYLES: Record<BnplBillStatus, string> = {
  upcoming: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  partially_paid:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const BILL_STATUS_LABELS: Record<BnplBillStatus, string> = {
  upcoming: "Upcoming",
  due: "Due",
  partially_paid: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

const EMI_STATUS_STYLES: Record<BnplPaymentStatus, string> = {
  upcoming: "text-gray-500",
  due: "text-amber-600",
  paid: "text-green-600",
  late_paid: "text-orange-600",
  overdue: "text-red-600",
  skipped: "text-gray-400",
};

const EMI_STATUS_LABELS: Record<BnplPaymentStatus, string> = {
  upcoming: "Upcoming",
  due: "Due",
  paid: "Paid",
  late_paid: "Late",
  overdue: "Overdue",
  skipped: "Skipped",
};

function getMonthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getEffectiveBillStatus(bill: BnplBill): BnplBillStatus {
  if (
    bill.status === "upcoming" &&
    bill.due_date < new Date().toISOString().split("T")[0]
  ) {
    return "overdue";
  }
  return bill.status;
}

interface BillCardProps {
  bill: BnplBill;
  fetchBillWithPayments: (
    billId: string
  ) => Promise<BnplBillWithPayments | null>;
  onPayBill: (bill: BnplBill) => void;
  onPayEMI: (paymentId: string, purchaseId: string) => void;
}

export function BillCard({
  bill,
  fetchBillWithPayments,
  onPayBill,
  onPayEMI,
}: BillCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [billDetail, setBillDetail] = useState<BnplBillWithPayments | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  const effectiveStatus = getEffectiveBillStatus(bill);
  const isPaid = effectiveStatus === "paid";
  const hasUnpaid = bill.total_amount > bill.paid_amount;
  const paidPercent =
    bill.total_amount > 0
      ? Math.round((bill.paid_amount / bill.total_amount) * 100)
      : 0;

  useEffect(() => {
    if (expanded && !billDetail) {
      setLoadingDetail(true);
      fetchBillWithPayments(bill.id).then((data) => {
        setBillDetail(data);
        setLoadingDetail(false);
      });
    }
  }, [expanded, bill.id, billDetail, fetchBillWithPayments]);

  return (
    <div className="rounded-lg border bg-card">
      {/* Bill header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium">
              {getMonthLabel(bill.bill_month, bill.bill_year)}
            </p>
            <p className="text-xs text-muted-foreground">
              Due {formatDate(bill.due_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold">
              {formatCurrency(bill.total_amount)}
            </p>
            {bill.paid_amount > 0 && bill.paid_amount < bill.total_amount && (
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(bill.paid_amount)} paid
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BILL_STATUS_STYLES[effectiveStatus]}`}
          >
            {BILL_STATUS_LABELS[effectiveStatus]}
          </span>
          {expanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Progress bar */}
          {bill.total_amount > 0 && (
            <div className="space-y-1">
              <Progress value={paidPercent} />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(bill.paid_amount)} of{" "}
                {formatCurrency(bill.total_amount)} paid ({paidPercent}%)
              </p>
            </div>
          )}

          {/* Purchase breakdown */}
          {loadingDetail ? (
            <div className="flex justify-center py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : billDetail && billDetail.payments.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Items in this bill
              </p>
              {billDetail.payments.map((payment) => {
                const isPaidEMI =
                  payment.status === "paid" || payment.status === "late_paid";
                const canPay =
                  payment.status === "upcoming" ||
                  payment.status === "due" ||
                  payment.status === "overdue";

                return (
                  <div
                    key={payment.payment_id}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-xs">
                        {payment.item_name}
                        <span className="ml-1 text-muted-foreground font-normal">
                          EMI {payment.emi_number}/{payment.total_emis}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium">
                        {formatCurrency(payment.amount)}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${EMI_STATUS_STYLES[payment.status]}`}
                      >
                        {EMI_STATUS_LABELS[payment.status]}
                      </span>
                      {canPay && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 text-[10px] px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPayEMI(payment.payment_id, payment.purchase_id);
                          }}
                        >
                          Pay
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No items in this bill.
            </p>
          )}

          {/* Pay full bill button */}
          {hasUnpaid && !isPaid && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onPayBill(bill)}
            >
              <IndianRupee className="size-3.5" />
              Pay Full Bill ({formatCurrency(bill.total_amount - bill.paid_amount)})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
