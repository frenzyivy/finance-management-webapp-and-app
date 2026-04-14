"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2, Plus, Receipt, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { BNPL_PLATFORM_TYPES } from "@/lib/constants/categories";
import type {
  BnplPlatformWithPurchases,
  BnplPurchase,
  BnplBill,
  BnplBillWithPayments,
} from "@/types/bnpl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PurchaseRow } from "./purchase-row";
import { BillCard } from "./bill-card";

interface PlatformCardProps {
  platform: BnplPlatformWithPurchases;
  onEditPlatform: (platformId: string) => void;
  onDeletePlatform: (platformId: string) => void;
  onAddPurchase: (platformId: string) => void;
  onPayEMI: (purchase: BnplPurchase) => void;
  onViewPurchase: (purchase: BnplPurchase) => void;
  onDeletePurchase: (purchase: BnplPurchase) => void;
  onPayBill?: (bill: BnplBill) => void;
  onPayBillEMI?: (paymentId: string, purchaseId: string) => void;
  fetchBills?: (platformId: string) => Promise<BnplBill[]>;
  fetchBillWithPayments?: (billId: string) => Promise<BnplBillWithPayments | null>;
  /** Called when "Upload Statement" is clicked for credit_card_emi platforms */
  onUploadStatement?: (platformId: string) => void;
}

function getPlatformTypeLabel(type: string): string {
  return BNPL_PLATFORM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function PlatformCard({
  platform,
  onEditPlatform,
  onDeletePlatform,
  onAddPurchase,
  onPayEMI,
  onViewPurchase,
  onDeletePurchase,
  onPayBill,
  onPayBillEMI,
  fetchBills,
  fetchBillWithPayments,
  onUploadStatement,
}: PlatformCardProps) {
  const [expanded, setExpanded] = useState(
    platform.active_purchases_count > 0
  );
  const hasBilling = platform.billing_day !== null && platform.billing_day !== undefined;
  const [viewMode, setViewMode] = useState<"bills" | "purchases">(
    hasBilling ? "bills" : "purchases"
  );
  const [bills, setBills] = useState<BnplBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const activePurchases = platform.purchases.filter(
    (p) => p.status === "active" || p.status === "overdue"
  );
  const completedPurchases = platform.purchases.filter(
    (p) => p.status === "paid_off" || p.status === "foreclosed"
  );

  const utilizationPercent =
    platform.credit_limit && platform.credit_limit > 0
      ? Math.round(
          (platform.current_outstanding / platform.credit_limit) * 100
        )
      : null;

  // Fetch bills when expanded in bills mode
  useEffect(() => {
    if (expanded && hasBilling && viewMode === "bills" && fetchBills && bills.length === 0) {
      setLoadingBills(true);
      fetchBills(platform.id).then((data) => {
        setBills(data);
        setLoadingBills(false);
      });
    }
  }, [expanded, hasBilling, viewMode, platform.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unpaidBills = bills.filter((b) => b.status !== "paid");
  const paidBills = bills.filter((b) => b.status === "paid");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: platform.color }}
            />
            <div>
              <CardTitle className="text-base">{platform.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {getPlatformTypeLabel(platform.platform_type)}
                </Badge>
                {platform.active_purchases_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {platform.active_purchases_count} active
                  </span>
                )}
                {hasBilling && (
                  <span className="text-xs text-muted-foreground">
                    Bill due: {platform.billing_day}th
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {platform.platform_type === "credit_card_emi" && onUploadStatement ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onUploadStatement(platform.id)}
                title="Upload statement"
              >
                <Upload className="size-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onAddPurchase(platform.id)}
                title="Add purchase"
              >
                <Plus className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditPlatform(platform.id)}
              title="Edit platform"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeletePlatform(platform.id)}
              title="Delete platform"
              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary row */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Outstanding: </span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(platform.current_outstanding)}
            </span>
          </div>
          {platform.monthly_emi_total > 0 && (
            <div>
              <span className="text-muted-foreground">Monthly EMI: </span>
              <span className="font-medium">
                {formatCurrency(platform.monthly_emi_total)}
              </span>
            </div>
          )}
        </div>

        {/* Credit limit utilization */}
        {utilizationPercent !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Credit limit utilization</span>
              <span>{utilizationPercent}%</span>
            </div>
            <Progress value={utilizationPercent} />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(platform.current_outstanding)} of{" "}
              {formatCurrency(platform.credit_limit!)} used
            </p>
          </div>
        )}

        {/* View mode toggle (only when billing is enabled) */}
        {hasBilling && platform.purchases.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setViewMode("bills")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "bills"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="inline size-3 mr-1" />
              Bills
            </button>
            <button
              onClick={() => setViewMode("purchases")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "purchases"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Purchases
            </button>
          </div>
        )}

        {/* Expand/collapse toggle */}
        {platform.purchases.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  Hide {viewMode === "bills" ? "bills" : "purchases"}
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  Show {viewMode === "bills" ? "bills" : `${platform.purchases.length} purchase${platform.purchases.length !== 1 ? "s" : ""}`}
                </>
              )}
            </button>

            {expanded && viewMode === "bills" && hasBilling && fetchBillWithPayments && onPayBill && onPayBillEMI && (
              <div className="space-y-2">
                {loadingBills ? (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    Loading bills...
                  </p>
                ) : bills.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    No bills generated yet. Add a purchase to generate bills.
                  </p>
                ) : (
                  <>
                    {unpaidBills.length > 0 && (
                      <div className="space-y-1.5">
                        {unpaidBills.map((bill) => (
                          <BillCard
                            key={bill.id}
                            bill={bill}
                            fetchBillWithPayments={fetchBillWithPayments}
                            onPayBill={onPayBill}
                            onPayEMI={onPayBillEMI}
                          />
                        ))}
                      </div>
                    )}
                    {paidBills.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground pt-1">
                          Paid Bills
                        </p>
                        {paidBills.slice(0, 3).map((bill) => (
                          <BillCard
                            key={bill.id}
                            bill={bill}
                            fetchBillWithPayments={fetchBillWithPayments}
                            onPayBill={onPayBill}
                            onPayEMI={onPayBillEMI}
                          />
                        ))}
                        {paidBills.length > 3 && (
                          <p className="text-center text-[10px] text-muted-foreground">
                            +{paidBills.length - 3} more paid bills
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {expanded && viewMode === "purchases" && (
              <div className="space-y-2">
                {activePurchases.length > 0 && (
                  <div className="space-y-2">
                    {activePurchases.map((purchase) => (
                      <PurchaseRow
                        key={purchase.id}
                        purchase={purchase}
                        onPay={() => onPayEMI(purchase)}
                        onClick={() => onViewPurchase(purchase)}
                        onDelete={() => onDeletePurchase(purchase)}
                      />
                    ))}
                  </div>
                )}

                {completedPurchases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground pt-1">
                      Completed
                    </p>
                    {completedPurchases.map((purchase) => (
                      <PurchaseRow
                        key={purchase.id}
                        purchase={purchase}
                        onPay={() => onPayEMI(purchase)}
                        onClick={() => onViewPurchase(purchase)}
                        onDelete={() => onDeletePurchase(purchase)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {platform.purchases.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {platform.platform_type === "credit_card_emi"
                ? "No statements uploaded yet."
                : "No purchases on this platform yet."}
            </p>
            {platform.platform_type === "credit_card_emi" && onUploadStatement ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => onUploadStatement(platform.id)}
              >
                <Upload className="size-3.5" />
                Upload Statement
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => onAddPurchase(platform.id)}
              >
                <Plus className="size-3.5" />
                Add Purchase
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
