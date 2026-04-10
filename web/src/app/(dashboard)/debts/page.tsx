"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  IndianRupee,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Loader2,
  Wallet,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

import { useDebts } from "@/hooks/use-debts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { DEBT_TYPES } from "@/lib/constants/categories";
import type { Debt, DebtPayment, DebtType } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { DebtForm } from "@/components/forms/debt-form";
import { DebtPaymentForm } from "@/components/forms/debt-payment-form";

// ── Helpers ──────────────────────────────────────────────────────────

const TYPE_BADGE_STYLES: Record<DebtType, string> = {
  credit_card: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  personal_loan:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  bnpl: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  borrowed_from_person:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

function getTypeLabel(type: DebtType): string {
  return DEBT_TYPES.find((dt) => dt.value === type)?.label ?? type;
}

function getPayoffPercentage(debt: Debt): number {
  if (debt.original_amount <= 0) return 100;
  const paid = debt.original_amount - debt.outstanding_balance;
  return Math.min(100, Math.max(0, Math.round((paid / debt.original_amount) * 100)));
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function DebtsPage() {
  const {
    debts,
    loading,
    fetchDebts,
    deleteDebt,
    addPayment,
    fetchPayments,
    totalDebt,
    activeDebts,
    totalMonthlyEMI,
    paidOffDebts,
  } = useDebts();

  // Dialog states
  const [debtFormOpen, setDebtFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>(undefined);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDebt, setDetailDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Fetch payments when detail dialog opens
  const openDetailDialog = useCallback(
    async (debt: Debt) => {
      setDetailDebt(debt);
      setDetailDialogOpen(true);
      setLoadingPayments(true);
      const result = await fetchPayments(debt.id);
      setPayments(result);
      setLoadingPayments(false);
    },
    [fetchPayments]
  );

  // Filter debts by tab
  const activeDebtsList = debts.filter((d) => d.status === "active");
  const paidOffDebtsList = debts.filter((d) => d.status === "paid_off");

  // EMI calendar — active debts with emi_amount and emi_day_of_month
  const now = new Date();
  const emiDebts = activeDebtsList.filter(
    (d) => d.emi_amount !== null && d.emi_day_of_month !== null
  );
  const upcomingEMIs = emiDebts
    .map((d) => {
      const emiDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        d.emi_day_of_month!
      );
      // If the date has passed this month, show next month
      const displayDate =
        emiDate < now
          ? new Date(now.getFullYear(), now.getMonth() + 1, d.emi_day_of_month!)
          : emiDate;
      const daysUntil = differenceInDays(displayDate, now);
      return { debt: d, date: displayDate, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAddDebt = () => {
    setEditingDebt(undefined);
    setDebtFormOpen(true);
  };

  const handleEditDebt = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDebt(debt);
    setDebtFormOpen(true);
  };

  const handleDebtFormSuccess = () => {
    setDebtFormOpen(false);
    setEditingDebt(undefined);
    fetchDebts();
  };

  const handleLogPayment = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setPaymentDebt(debt);
    setPaymentFormOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentFormOpen(false);
    setPaymentDebt(null);
  };

  const handleDeleteClick = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDebt(debt);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDebt) return;
    setDeleting(true);
    await deleteDebt(deletingDebt.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingDebt(null);
  };

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="size-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Debt Tracker</h2>
        </div>
        <Button onClick={handleAddDebt}>
          <Plus className="size-4" />
          Add Debt
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Debt</CardDescription>
            <CardTitle className="text-xl text-red-600 dark:text-red-400">
              {formatCurrency(totalDebt)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Active Debts</CardDescription>
            <CardTitle className="text-xl">{activeDebts}</CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Monthly EMI Total</CardDescription>
            <CardTitle className="text-xl">
              {formatCurrency(totalMonthlyEMI)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Paid Off</CardDescription>
            <CardTitle className="text-xl text-green-600 dark:text-green-400">
              {paidOffDebts}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Debt List with Tabs */}
      {debts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-4 size-12 text-green-500" />
            <p className="text-lg font-medium">No debts tracked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              That&apos;s great! Or add your debts to start tracking payoff.
            </p>
            <Button className="mt-4" onClick={handleAddDebt}>
              <Plus className="size-4" />
              Add Your First Debt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeDebtsList.length})
            </TabsTrigger>
            <TabsTrigger value="paid_off">
              Paid Off ({paidOffDebtsList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeDebtsList.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-4 size-10 text-green-500" />
                  <p className="font-medium">No active debts</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You&apos;ve paid off all your debts. Congratulations!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeDebtsList.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onLogPayment={handleLogPayment}
                    onEdit={handleEditDebt}
                    onDelete={handleDeleteClick}
                    onClick={() => openDetailDialog(debt)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="paid_off">
            {paidOffDebtsList.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="mb-4 size-10 text-muted-foreground" />
                  <p className="font-medium">No paid off debts yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep going! Your paid off debts will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {paidOffDebtsList.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onLogPayment={handleLogPayment}
                    onEdit={handleEditDebt}
                    onDelete={handleDeleteClick}
                    onClick={() => openDetailDialog(debt)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* EMI Calendar Section */}
      {upcomingEMIs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">Upcoming EMIs</h3>
          </div>
          <Card>
            <CardContent className="divide-y">
              {upcomingEMIs.map(({ debt, date, daysUntil }) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {daysUntil <= 3 && daysUntil >= 0 ? (
                      <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    ) : (
                      <IndianRupee className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{debt.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {debt.creditor_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        daysUntil <= 3 && daysUntil >= 0
                          ? "text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {formatCurrency(debt.emi_amount!)} due on{" "}
                      {format(date, "do MMM yyyy")}
                    </p>
                    {daysUntil <= 3 && daysUntil >= 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {daysUntil === 0
                          ? "Due today"
                          : daysUntil === 1
                            ? "Due tomorrow"
                            : `Due in ${daysUntil} days`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────── */}

      {/* Add / Edit Debt Dialog */}
      <Dialog open={debtFormOpen} onOpenChange={setDebtFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDebt ? "Edit Debt" : "Add New Debt"}
            </DialogTitle>
            <DialogDescription>
              {editingDebt
                ? "Update the details of this debt."
                : "Enter the details of your debt to start tracking payoff."}
            </DialogDescription>
          </DialogHeader>
          <DebtForm
            debt={editingDebt}
            onSuccess={handleDebtFormSuccess}
            onCancel={() => setDebtFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Log Payment Dialog */}
      <Dialog open={paymentFormOpen} onOpenChange={setPaymentFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Payment</DialogTitle>
            <DialogDescription>
              Record a payment towards this debt.
            </DialogDescription>
          </DialogHeader>
          {paymentDebt && (
            <DebtPaymentForm
              debtId={paymentDebt.id}
              debtName={paymentDebt.name}
              outstandingBalance={paymentDebt.outstanding_balance}
              onSubmitPayment={addPayment}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setPaymentFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Debt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{deletingDebt?.name}</span>? This
              action cannot be undone. All payment history for this debt will
              also be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debt Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {detailDebt && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle>{detailDebt.name}</DialogTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_STYLES[detailDebt.type]}`}
                  >
                    {getTypeLabel(detailDebt.type)}
                  </span>
                </div>
                <DialogDescription>{detailDebt.creditor_name}</DialogDescription>
              </DialogHeader>

              {/* Debt Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Original Amount</p>
                  <p className="font-medium">
                    {formatCurrency(detailDebt.original_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outstanding</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(detailDebt.outstanding_balance)}
                  </p>
                </div>
                {detailDebt.interest_rate > 0 && (
                  <div>
                    <p className="text-muted-foreground">Interest Rate</p>
                    <p className="font-medium">{detailDebt.interest_rate}%</p>
                  </div>
                )}
                {detailDebt.emi_amount !== null && (
                  <div>
                    <p className="text-muted-foreground">EMI Amount</p>
                    <p className="font-medium">
                      {formatCurrency(detailDebt.emi_amount)}/month
                    </p>
                  </div>
                )}
                {detailDebt.emi_day_of_month !== null && (
                  <div>
                    <p className="text-muted-foreground">EMI Due Day</p>
                    <p className="font-medium">
                      {detailDebt.emi_day_of_month}
                      {getOrdinalSuffix(detailDebt.emi_day_of_month)} of each
                      month
                    </p>
                  </div>
                )}
                {detailDebt.remaining_emis !== null && (
                  <div>
                    <p className="text-muted-foreground">Remaining EMIs</p>
                    <p className="font-medium">
                      {detailDebt.remaining_emis}
                      {detailDebt.total_emis !== null &&
                        ` of ${detailDebt.total_emis}`}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {formatDate(detailDebt.start_date)}
                  </p>
                </div>
                {detailDebt.expected_payoff_date && (
                  <div>
                    <p className="text-muted-foreground">Expected Payoff</p>
                    <p className="font-medium">
                      {formatDate(detailDebt.expected_payoff_date)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p
                    className={`font-medium ${
                      detailDebt.status === "paid_off"
                        ? "text-green-600 dark:text-green-400"
                        : ""
                    }`}
                  >
                    {detailDebt.status === "paid_off" ? "Paid Off" : "Active"}
                  </p>
                </div>
              </div>

              {detailDebt.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Notes</p>
                  <p>{detailDebt.notes}</p>
                </div>
              )}

              {/* Progress */}
              <div className="space-y-2">
                <Progress value={getPayoffPercentage(detailDebt)} />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(
                    detailDebt.original_amount - detailDebt.outstanding_balance
                  )}{" "}
                  paid of {formatCurrency(detailDebt.original_amount)} (
                  {getPayoffPercentage(detailDebt)}%)
                </p>
              </div>

              <Separator />

              {/* Payment History */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Payment History</h4>
                {loadingPayments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {formatCurrency(payment.amount)}
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-muted-foreground">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Debt Card Component ──────────────────────────────────────────────

interface DebtCardProps {
  debt: Debt;
  onLogPayment: (debt: Debt, e: React.MouseEvent) => void;
  onEdit: (debt: Debt, e: React.MouseEvent) => void;
  onDelete: (debt: Debt, e: React.MouseEvent) => void;
  onClick: () => void;
}

function DebtCard({
  debt,
  onLogPayment,
  onEdit,
  onDelete,
  onClick,
}: DebtCardProps) {
  const percentage = getPayoffPercentage(debt);
  const paid = debt.original_amount - debt.outstanding_balance;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{debt.name}</CardTitle>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_STYLES[debt.type]}`}
            >
              {getTypeLabel(debt.type)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => onEdit(debt, e)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={(e) => onDelete(debt, e)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        <CardDescription>{debt.creditor_name}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Outstanding Balance */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Outstanding</span>
          <span
            className={`text-lg font-bold ${
              debt.status === "paid_off"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatCurrency(debt.outstanding_balance)}
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <Progress value={percentage} />
          <p className="text-xs text-muted-foreground">
            {formatCurrency(paid)} paid of{" "}
            {formatCurrency(debt.original_amount)} ({percentage}%)
          </p>
        </div>

        {/* EMI Info */}
        {debt.emi_amount !== null && (
          <p className="text-xs text-muted-foreground">
            EMI: {formatCurrency(debt.emi_amount)}/month
            {debt.emi_day_of_month !== null &&
              ` | Due: ${debt.emi_day_of_month}${getOrdinalSuffix(debt.emi_day_of_month)}`}
            {debt.remaining_emis !== null &&
              ` | ${debt.remaining_emis} EMI${debt.remaining_emis !== 1 ? "s" : ""} remaining`}
          </p>
        )}

        {/* Interest Rate */}
        {debt.interest_rate > 0 && (
          <p className="text-xs text-muted-foreground">
            Interest: {debt.interest_rate}%
          </p>
        )}

        {/* Payoff projection */}
        {debt.status === "active" && debt.expected_payoff_date && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            Debt-free by {formatDate(debt.expected_payoff_date)}
          </p>
        )}

        {debt.status === "paid_off" && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            Fully paid off
          </p>
        )}

        {/* Log Payment Button */}
        {debt.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={(e) => onLogPayment(debt, e)}
          >
            <IndianRupee className="size-3.5" />
            Log Payment
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
