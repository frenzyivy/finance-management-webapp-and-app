"use client";

import { IndianRupee, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { BNPL_PURCHASE_CATEGORIES } from "@/lib/constants/categories";
import type { BnplPurchase, BnplPurchaseStatus } from "@/types/bnpl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const STATUS_STYLES: Record<BnplPurchaseStatus, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid_off:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  foreclosed:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

const STATUS_LABELS: Record<BnplPurchaseStatus, string> = {
  active: "Active",
  paid_off: "Paid Off",
  overdue: "Overdue",
  foreclosed: "Foreclosed",
};

function getCategoryLabel(category: string): string {
  return (
    BNPL_PURCHASE_CATEGORIES.find((c) => c.value === category)?.label ??
    category
  );
}

interface PurchaseRowProps {
  purchase: BnplPurchase;
  onPay: () => void;
  onClick: () => void;
  onDelete: () => void;
}

export function PurchaseRow({
  purchase,
  onPay,
  onClick,
  onDelete,
}: PurchaseRowProps) {
  const progressPercent =
    purchase.total_emis > 0
      ? Math.round((purchase.paid_emis / purchase.total_emis) * 100)
      : 0;

  const isActive =
    purchase.status === "active" || purchase.status === "overdue";

  return (
    <div
      className="cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      {/* Top row: name + badges + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate font-medium text-sm">{purchase.item_name}</p>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[purchase.status]}`}>
              {STATUS_LABELS[purchase.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {getCategoryLabel(purchase.item_category)} | {formatDate(purchase.purchase_date)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onPay();
              }}
            >
              <IndianRupee className="size-3" />
              Pay
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 space-y-1">
        <Progress value={progressPercent} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {purchase.paid_emis}/{purchase.total_emis} EMIs |{" "}
            {formatCurrency(purchase.emi_amount)}/mo
          </span>
          <span>
            {formatCurrency(purchase.outstanding_balance)} remaining
          </span>
        </div>
      </div>
    </div>
  );
}
