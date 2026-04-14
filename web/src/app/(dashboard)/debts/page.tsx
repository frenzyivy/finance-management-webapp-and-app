"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  ChevronDown,
  ShoppingBag,
  Sparkles,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

import { useDebts } from "@/hooks/use-debts";
import { useBnpl } from "@/hooks/use-bnpl";
import { useBnplParser } from "@/hooks/use-bnpl-parser";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { DEBT_TYPES } from "@/lib/constants/categories";
import {
  getPaymentReminders,
  getUrgencyLevel,
} from "@/lib/utils/payment-reminders";
import type { UrgencyLevel } from "@/lib/utils/payment-reminders";
import type {
  Debt,
  DebtPayment,
  DebtAllocation,
  DebtType,
} from "@/types/database";
import type {
  BnplPurchase,
  BnplPayment,
  BnplPlatform,
  BnplBill,
  BnplUpcomingEMI,
} from "@/types/bnpl";

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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { DebtForm } from "@/components/forms/debt-form";
import { DebtPaymentForm } from "@/components/forms/debt-payment-form";
import { DebtAllocationForm } from "@/components/forms/debt-allocation-form";
import { BnplPlatformForm } from "@/components/forms/bnpl-platform-form";
import { BnplPurchaseForm } from "@/components/forms/bnpl-purchase-form";
import { BnplPaymentForm } from "@/components/forms/bnpl-payment-form";
import { BnplBillPaymentForm } from "@/components/forms/bnpl-bill-payment-form";
import { PlatformCard } from "@/components/bnpl/platform-card";
import { PurchaseDetailModal } from "@/components/bnpl/purchase-detail-modal";
import { StatementUploadDialog } from "@/components/cc/statement-upload-dialog";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";

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

type DebtFilter = "all" | "personal" | "bnpl" | "credit_cards";

function getTypeLabel(type: DebtType): string {
  return DEBT_TYPES.find((dt) => dt.value === type)?.label ?? type;
}

function getPayoffPercentage(debt: Debt): number {
  if (debt.original_amount <= 0) return 100;
  const paid = debt.original_amount - debt.outstanding_balance;
  return Math.min(
    100,
    Math.max(0, Math.round((paid / debt.original_amount) * 100))
  );
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

function filterDebts(debts: Debt[], filter: DebtFilter): Debt[] {
  switch (filter) {
    case "personal":
      return debts.filter((d) =>
        ["personal_loan", "borrowed_from_person", "other"].includes(d.type)
      );
    case "credit_cards":
      return debts.filter((d) => d.type === "credit_card");
    case "bnpl":
      return debts.filter((d) => d.type === "bnpl");
    default:
      return debts;
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function DebtsPage() {
  const router = useRouter();
  const {
    debts,
    loading: debtsLoading,
    fetchDebts,
    deleteDebt,
    addPayment,
    fetchPayments,
    fetchAllocations,
    totalDebt,
    activeDebts,
    totalMonthlyEMI,
    paidOffDebts,
  } = useDebts();

  const {
    platforms,
    purchases,
    loading: bnplLoading,
    fetchAll: fetchBnpl,
    fetchPayments: fetchBnplPayments,
    addPlatform,
    updatePlatform,
    deletePlatform,
    addPurchase,
    deletePurchase,
    payEMI,
    foreclosePurchase,
    fetchBills,
    fetchBillWithPayments,
    payBill,
    totalBnplOutstanding,
    totalBnplMonthlyEMI,
    activePurchasesCount,
    paidOffPurchases,
    platformsWithPurchases,
  } = useBnpl();

  const loading = debtsLoading || bnplLoading;

  // Filter state
  const [activeFilter, setActiveFilter] = useState<DebtFilter>("all");

  // ── Debt dialog states ──
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
  const [allocations, setAllocations] = useState<DebtAllocation[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocationFormOpen, setAllocationFormOpen] = useState(false);
  const [allocationDebt, setAllocationDebt] = useState<Debt | null>(null);

  // ── BNPL dialog states ──
  const [platformFormOpen, setPlatformFormOpen] = useState(false);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [preselectedPlatformId, setPreselectedPlatformId] = useState<string | undefined>();
  const [pendingOrderFile, setPendingOrderFile] = useState<File | null>(null);
  const [pendingEmiFile, setPendingEmiFile] = useState<File | null>(null);
  const [autoOpenUpload, setAutoOpenUpload] = useState(false);
  const { uploadInvoiceFile, attachInvoicesToPurchase } = useBnplParser();
  const [bnplPaymentFormOpen, setBnplPaymentFormOpen] = useState(false);
  const [payingEmiPayment, setPayingEmiPayment] = useState<BnplPayment | null>(null);
  const [payingEmiPurchase, setPayingEmiPurchase] = useState<BnplPurchase | null>(null);
  const [purchaseDetailOpen, setPurchaseDetailOpen] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<BnplPurchase | null>(null);
  const [detailPlatformName, setDetailPlatformName] = useState("");
  const [detailPlatformColor, setDetailPlatformColor] = useState("");
  const [deletePlatformOpen, setDeletePlatformOpen] = useState(false);
  const [deletingPlatformId, setDeletingPlatformId] = useState<string | null>(null);
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState<BnplPurchase | null>(null);
  const [forecloseOpen, setForecloseOpen] = useState(false);
  const [foreclosingPurchase, setForeclosingPurchase] = useState<BnplPurchase | null>(null);
  const [billPaymentOpen, setBillPaymentOpen] = useState(false);
  const [payingBill, setPayingBill] = useState<BnplBill | null>(null);

  // ── CC Statement dialog states ──
  const [ccStatementOpen, setCcStatementOpen] = useState(false);
  const [ccStatementPlatformId, setCcStatementPlatformId] = useState<string | null>(null);
  const [ccStatementCardName, setCcStatementCardName] = useState("");

  // BNPL upcoming EMIs
  const [bnplUpcomingEMIs, setBnplUpcomingEMIs] = useState<BnplUpcomingEMI[]>([]);
  const { fetchUpcomingEMIs } = useBnpl();

  useEffect(() => {
    fetchUpcomingEMIs(31).then(setBnplUpcomingEMIs);
  }, [purchases]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debt handlers ──

  const openDetailDialog = useCallback(
    async (debt: Debt) => {
      setDetailDebt(debt);
      setDetailDialogOpen(true);
      setLoadingPayments(true);
      setLoadingAllocations(true);
      const [paymentResult, allocationResult] = await Promise.all([
        fetchPayments(debt.id),
        fetchAllocations(debt.id),
      ]);
      setPayments(paymentResult);
      setAllocations(allocationResult);
      setLoadingPayments(false);
      setLoadingAllocations(false);
    },
    [fetchPayments, fetchAllocations]
  );

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

  const handleAllocateClick = (debt: Debt, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAllocationDebt(debt);
    setAllocationFormOpen(true);
  };

  const handleAllocationSuccess = () => {
    setAllocationFormOpen(false);
    setAllocationDebt(null);
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

  // ── BNPL handlers ──

  const handleAddPlatform = () => {
    setEditingPlatformId(null);
    setPlatformFormOpen(true);
  };

  const handleEditPlatform = (platformId: string) => {
    setEditingPlatformId(platformId);
    setPlatformFormOpen(true);
  };

  const handlePlatformFormSuccess = () => {
    setPlatformFormOpen(false);
    setEditingPlatformId(null);
  };

  const handleAddPurchase = (platformId?: string) => {
    setPreselectedPlatformId(platformId);
    setAutoOpenUpload(false);
    setPurchaseFormOpen(true);
  };

  const handleAddPurchaseFromInvoice = () => {
    setPreselectedPlatformId(undefined);
    setAutoOpenUpload(true);
    setPurchaseFormOpen(true);
  };

  const handlePurchaseFormSuccess = () => {
    setPurchaseFormOpen(false);
    setPreselectedPlatformId(undefined);
    setAutoOpenUpload(false);
    setPendingOrderFile(null);
    setPendingEmiFile(null);
  };

  const handleInvoicesSelected = (orderFile: File, emiFile: File | null) => {
    setPendingOrderFile(orderFile);
    setPendingEmiFile(emiFile);
  };

  // Wraps addPurchase so that after successful creation we upload any
  // pending invoice files to Storage and attach them to the purchase record.
  const addPurchaseWithInvoices: typeof addPurchase = async (params) => {
    const result = await addPurchase(params);
    if (result.error) return result;

    // Extract purchase_id from the RPC response
    const rpcData = result.data as { purchase_id?: string } | null | undefined;
    const purchaseId = rpcData?.purchase_id;
    if (!purchaseId || (!pendingOrderFile && !pendingEmiFile)) {
      return result;
    }

    // Upload files (best-effort — don't block success on upload failure)
    try {
      const uploaded = [];
      if (pendingOrderFile) {
        const { data } = await uploadInvoiceFile(pendingOrderFile, purchaseId, "order_invoice");
        if (data) uploaded.push(data);
      }
      if (pendingEmiFile) {
        const { data } = await uploadInvoiceFile(pendingEmiFile, purchaseId, "emi_confirmation");
        if (data) uploaded.push(data);
      }
      if (uploaded.length > 0) {
        await attachInvoicesToPurchase(purchaseId, uploaded);
      }
    } catch (err) {
      console.error("Invoice upload failed:", err);
    }

    return result;
  };

  const handlePayEMI = async (purchase: BnplPurchase) => {
    const payments = await fetchBnplPayments(purchase.id);
    const today = new Date().toISOString().split("T")[0];
    // Find first unpaid EMI (overdue first, then upcoming/due)
    const overduePayment = payments.find(
      (p) => p.status === "upcoming" && p.due_date < today
    );
    const nextPayment = payments.find(
      (p) => p.status === "upcoming" || p.status === "due" || p.status === "overdue"
    );
    const paymentToUse = overduePayment || nextPayment;
    if (paymentToUse) {
      setPayingEmiPayment(paymentToUse);
      setPayingEmiPurchase(purchase);
      setBnplPaymentFormOpen(true);
    }
  };

  const handlePayEMIFromSchedule = (payment: BnplPayment) => {
    const purchase = purchases.find((p) => p.id === payment.purchase_id);
    if (purchase) {
      setPayingEmiPayment(payment);
      setPayingEmiPurchase(purchase);
      setBnplPaymentFormOpen(true);
    }
  };

  const handleBnplPaymentSuccess = () => {
    setBnplPaymentFormOpen(false);
    setPayingEmiPayment(null);
    setPayingEmiPurchase(null);
  };

  const handleViewPurchase = (purchase: BnplPurchase) => {
    const platform = platforms.find((p) => p.id === purchase.platform_id);
    setDetailPurchase(purchase);
    setDetailPlatformName(platform?.name ?? "");
    setDetailPlatformColor(platform?.color ?? "#6b7280");
    setPurchaseDetailOpen(true);
  };

  const handleDeletePlatformClick = (platformId: string) => {
    setDeletingPlatformId(platformId);
    setDeletePlatformOpen(true);
  };

  const handleConfirmDeletePlatform = async () => {
    if (!deletingPlatformId) return;
    setDeleting(true);
    await deletePlatform(deletingPlatformId);
    setDeleting(false);
    setDeletePlatformOpen(false);
    setDeletingPlatformId(null);
  };

  const handleDeletePurchaseClick = (purchase: BnplPurchase) => {
    setDeletingPurchase(purchase);
    setDeletePurchaseOpen(true);
  };

  const handleConfirmDeletePurchase = async () => {
    if (!deletingPurchase) return;
    setDeleting(true);
    await deletePurchase(deletingPurchase.id);
    setDeleting(false);
    setDeletePurchaseOpen(false);
    setDeletingPurchase(null);
  };

  const handleForeclose = (purchase: BnplPurchase) => {
    setForeclosingPurchase(purchase);
    setForecloseOpen(true);
  };

  const handleConfirmForeclose = async () => {
    if (!foreclosingPurchase) return;
    setDeleting(true);
    await foreclosePurchase(foreclosingPurchase.id);
    setDeleting(false);
    setForecloseOpen(false);
    setForeclosingPurchase(null);
    setPurchaseDetailOpen(false);
  };

  // ── Bill handlers ──

  const handlePayBill = (bill: BnplBill) => {
    setPayingBill(bill);
    setBillPaymentOpen(true);
  };

  const handleBillPaymentSuccess = () => {
    setBillPaymentOpen(false);
    setPayingBill(null);
  };

  const handlePayBillEMI = async (paymentId: string, purchaseId: string) => {
    const payments = await fetchBnplPayments(purchaseId);
    const payment = payments.find((p) => p.id === paymentId);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (payment && purchase) {
      setPayingEmiPayment(payment);
      setPayingEmiPurchase(purchase);
      setBnplPaymentFormOpen(true);
    }
  };

  // ── CC Statement handlers ──

  const handleUploadStatement = (platformId: string) => {
    const platform = platforms.find((p) => p.id === platformId);
    setCcStatementPlatformId(platformId);
    setCcStatementCardName(platform?.name || "Credit Card");
    setCcStatementOpen(true);
  };

  const handleCcStatementSaved = () => {
    setCcStatementOpen(false);
    setCcStatementPlatformId(null);
    fetchBnpl();
  };

  // ── Filtered data ──

  const filteredDebts = filterDebts(debts, activeFilter);
  const activeDebtsList = filteredDebts.filter((d) => d.status === "active");
  const paidOffDebtsList = filteredDebts.filter((d) => d.status === "paid_off");

  const showBnpl = activeFilter === "all" || activeFilter === "bnpl";

  // Combined summary
  const combinedTotalDebt = totalDebt + totalBnplOutstanding;
  const combinedActiveCount = activeDebts + activePurchasesCount;
  const combinedMonthlyEMI = totalMonthlyEMI + totalBnplMonthlyEMI;
  const combinedPaidOff = paidOffDebts + paidOffPurchases;

  // Debt upcoming EMIs
  const debtUpcomingEMIs = getPaymentReminders(debts, 31);

  // Editing platform data
  const editingPlatform = editingPlatformId
    ? platforms.find((p) => p.id === editingPlatformId)
    : undefined;

  // Find platform name for payment form
  const payingPlatformName = payingEmiPurchase
    ? platforms.find((p) => p.id === payingEmiPurchase.platform_id)?.name ?? ""
    : "";

  const payingBillPlatformName = payingBill
    ? platforms.find((p) => p.id === payingBill.platform_id)?.name ?? ""
    : "";

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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button>
                <Plus className="size-4" />
                Add
                <ChevronDown className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddDebt}>
              <CreditCard className="size-4" />
              Add Debt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleAddPurchase()}>
              <ShoppingBag className="size-4" />
              Add BNPL Purchase
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddPurchaseFromInvoice}>
              <Sparkles className="size-4" />
              Add from Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddPlatform}>
              <Plus className="size-4" />
              Add BNPL Platform
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              // Find the first credit_card_emi platform or prompt to add one
              const ccPlatform = platforms.find((p) => p.platform_type === "credit_card_emi");
              if (ccPlatform) {
                handleUploadStatement(ccPlatform.id);
              } else {
                handleAddPlatform();
              }
            }}>
              <CreditCard className="size-4" />
              Upload CC Statement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/debts/invoices")}>
              <FileText className="size-4" />
              View Invoice Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Debt</CardDescription>
            <CardTitle className="text-xl text-red-600 dark:text-red-400">
              {formatCurrency(combinedTotalDebt)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Active Debts</CardDescription>
            <CardTitle className="text-xl">{combinedActiveCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Monthly EMI Total</CardDescription>
            <CardTitle className="text-xl">
              {formatCurrency(combinedMonthlyEMI)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Paid Off</CardDescription>
            <CardTitle className="text-xl text-green-600 dark:text-green-400">
              {combinedPaidOff}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {(
          [
            { value: "all", label: "All Debts" },
            { value: "personal", label: "Personal" },
            { value: "bnpl", label: "BNPL / EMI" },
            { value: "credit_cards", label: "Credit Cards" },
          ] as const
        ).map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === filter.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {debts.length === 0 && purchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-4 size-12 text-green-500" />
            <p className="text-lg font-medium">No debts tracked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              That&apos;s great! Or add your debts to start tracking payoff.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleAddDebt}>
                <Plus className="size-4" />
                Add Debt
              </Button>
              <Button variant="outline" onClick={() => handleAddPurchase()}>
                <ShoppingBag className="size-4" />
                Add BNPL Purchase
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeDebtsList.length + (showBnpl ? activePurchasesCount : 0)})
            </TabsTrigger>
            <TabsTrigger value="paid_off">
              Paid Off ({paidOffDebtsList.length + (showBnpl ? paidOffPurchases : 0)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {/* BNPL Platform Cards */}
            {showBnpl && platformsWithPurchases.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="size-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    BNPL / EMI Purchases
                  </h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {platformsWithPurchases
                    .filter((p) => p.active_purchases_count > 0 || p.status === "active")
                    .map((platform) => (
                      <PlatformCard
                        key={platform.id}
                        platform={platform}
                        onEditPlatform={handleEditPlatform}
                        onDeletePlatform={handleDeletePlatformClick}
                        onAddPurchase={handleAddPurchase}
                        onPayEMI={handlePayEMI}
                        onViewPurchase={handleViewPurchase}
                        onDeletePurchase={handleDeletePurchaseClick}
                        onPayBill={handlePayBill}
                        onPayBillEMI={handlePayBillEMI}
                        fetchBills={fetchBills}
                        fetchBillWithPayments={fetchBillWithPayments}
                        onUploadStatement={handleUploadStatement}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Regular Debt Cards */}
            {activeDebtsList.length > 0 && (
              <div className="space-y-3">
                {showBnpl && platformsWithPurchases.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Regular Debts
                    </h3>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {activeDebtsList.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      onLogPayment={handleLogPayment}
                      onEdit={handleEditDebt}
                      onDelete={handleDeleteClick}
                      onAllocate={handleAllocateClick}
                      onClick={() => openDetailDialog(debt)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeDebtsList.length === 0 &&
              (!showBnpl || activePurchasesCount === 0) && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="mb-4 size-10 text-green-500" />
                    <p className="font-medium">No active debts</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You&apos;ve paid off all your debts. Congratulations!
                    </p>
                  </CardContent>
                </Card>
              )}
          </TabsContent>

          <TabsContent value="paid_off" className="space-y-6">
            {paidOffDebtsList.length === 0 &&
            (!showBnpl || paidOffPurchases === 0) ? (
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
                    onAllocate={handleAllocateClick}
                    onClick={() => openDetailDialog(debt)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Upcoming EMIs Section */}
      {(debtUpcomingEMIs.length > 0 || bnplUpcomingEMIs.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">Upcoming EMIs</h3>
          </div>
          <Card>
            <CardContent className="divide-y">
              {/* Debt EMIs */}
              {debtUpcomingEMIs.map((reminder) => {
                const urgencyColors: Record<UrgencyLevel, string> = {
                  overdue: "text-red-600 dark:text-red-400",
                  urgent: "text-red-600 dark:text-red-400",
                  warning: "text-amber-600 dark:text-amber-400",
                  normal: "",
                };
                const colorClass = urgencyColors[reminder.urgency];
                const showIcon = reminder.urgency !== "normal";
                const dueLabel =
                  reminder.daysUntil < 0
                    ? `Overdue by ${Math.abs(reminder.daysUntil)} day${Math.abs(reminder.daysUntil) === 1 ? "" : "s"}`
                    : reminder.daysUntil === 0
                      ? "Due today"
                      : reminder.daysUntil === 1
                        ? "Due tomorrow"
                        : `Due in ${reminder.daysUntil} days`;

                return (
                  <div
                    key={`debt-${reminder.debtId}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      {showIcon ? (
                        <AlertCircle
                          className={`size-4 shrink-0 ${colorClass || "text-amber-500"}`}
                        />
                      ) : (
                        <IndianRupee className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{reminder.debtName}</p>
                        <p className="text-xs text-muted-foreground">
                          {reminder.creditorName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${colorClass}`}>
                        {formatCurrency(reminder.amount)} due on{" "}
                        {format(reminder.dueDate, "do MMM yyyy")}
                      </p>
                      {reminder.daysUntil <= 5 && (
                        <p
                          className={`text-xs ${colorClass || "text-muted-foreground"}`}
                        >
                          {dueLabel}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* BNPL EMIs */}
              {bnplUpcomingEMIs.map((emi) => {
                const today = new Date().toISOString().split("T")[0];
                const dueDate = new Date(emi.due_date);
                const diffDays = Math.ceil(
                  (dueDate.getTime() - new Date().getTime()) / 86400000
                );
                const urgency = getUrgencyLevel(diffDays);
                const urgencyColors: Record<UrgencyLevel, string> = {
                  overdue: "text-red-600 dark:text-red-400",
                  urgent: "text-red-600 dark:text-red-400",
                  warning: "text-amber-600 dark:text-amber-400",
                  normal: "",
                };
                const colorClass = urgencyColors[urgency];
                const showIcon = urgency !== "normal";
                const dueLabel =
                  diffDays < 0
                    ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`
                    : diffDays === 0
                      ? "Due today"
                      : diffDays === 1
                        ? "Due tomorrow"
                        : `Due in ${diffDays} days`;

                return (
                  <div
                    key={`bnpl-${emi.payment_id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      {showIcon ? (
                        <AlertCircle
                          className={`size-4 shrink-0 ${colorClass || "text-amber-500"}`}
                        />
                      ) : (
                        <ShoppingBag className="size-4 shrink-0 text-purple-500" />
                      )}
                      <div>
                        <p className="font-medium">
                          {emi.item_name}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            EMI {emi.emi_number}/{emi.total_emis}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span
                            className="mr-1 inline-block size-2 rounded-full"
                            style={{ backgroundColor: emi.platform_color }}
                          />
                          {emi.platform_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${colorClass}`}>
                        {formatCurrency(emi.amount)} due on{" "}
                        {formatDate(emi.due_date)}
                      </p>
                      {diffDays <= 5 && (
                        <p
                          className={`text-xs ${colorClass || "text-muted-foreground"}`}
                        >
                          {dueLabel}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Debt Dialogs ──────────────────────────────────────── */}

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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Debt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{deletingDebt?.name}</span>? This
              action cannot be undone.
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

      <Dialog open={allocationFormOpen} onOpenChange={setAllocationFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate Spending</DialogTitle>
            <DialogDescription>
              Where did the borrowed money go? Allocate it to expense categories.
            </DialogDescription>
          </DialogHeader>
          {allocationDebt && (
            <DebtAllocationForm
              debt={allocationDebt}
              onSuccess={handleAllocationSuccess}
              onCancel={() => setAllocationFormOpen(false)}
            />
          )}
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

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="allocations" className="flex-1">
                    Where Money Went
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex-1">
                    Payments
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
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
                        <p className="font-medium">
                          {detailDebt.interest_rate}%
                        </p>
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
                          {getOrdinalSuffix(detailDebt.emi_day_of_month)} of
                          each month
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
                        className={`font-medium ${detailDebt.status === "paid_off" ? "text-green-600 dark:text-green-400" : ""}`}
                      >
                        {detailDebt.status === "paid_off"
                          ? "Paid Off"
                          : "Active"}
                      </p>
                    </div>
                  </div>

                  {detailDebt.notes && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Notes</p>
                      <p>{detailDebt.notes}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Progress value={getPayoffPercentage(detailDebt)} />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        detailDebt.original_amount -
                          detailDebt.outstanding_balance
                      )}{" "}
                      paid of {formatCurrency(detailDebt.original_amount)} (
                      {getPayoffPercentage(detailDebt)}%)
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="allocations" className="space-y-4">
                  {(() => {
                    const allocated = detailDebt.allocated_amount ?? 0;
                    const unallocated = detailDebt.original_amount - allocated;
                    const allocPercent =
                      detailDebt.original_amount > 0
                        ? Math.round(
                            (allocated / detailDebt.original_amount) * 100
                          )
                        : 0;
                    return (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>
                              Allocated: {formatCurrency(allocated)} /{" "}
                              {formatCurrency(detailDebt.original_amount)}
                            </span>
                            <span>{allocPercent}%</span>
                          </div>
                          <Progress value={allocPercent} className="h-2" />
                          {unallocated > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              {formatCurrency(unallocated)} unallocated
                            </p>
                          )}
                        </div>

                        {loadingAllocations ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : allocations.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">
                              No allocations recorded yet.
                            </p>
                            {detailDebt.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() =>
                                  handleAllocateClick(detailDebt)
                                }
                              >
                                <Plus className="size-3.5" />
                                Allocate spending
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="max-h-48 space-y-2 overflow-y-auto">
                            {allocations.map((alloc) => {
                              const catLabel = EXPENSE_CATEGORIES.find(
                                (c) =>
                                  c.value ===
                                  (
                                    alloc as DebtAllocation & {
                                      category?: string;
                                    }
                                  ).category
                              )?.label;
                              return (
                                <div
                                  key={alloc.id}
                                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                                >
                                  <div>
                                    <p className="font-medium">
                                      {formatCurrency(alloc.amount)}
                                      {catLabel && (
                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                          {catLabel}
                                        </span>
                                      )}
                                    </p>
                                    {alloc.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {alloc.description}
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(alloc.date)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {allocations.length > 0 &&
                          unallocated > 0 &&
                          detailDebt.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAllocateClick(detailDebt)
                              }
                            >
                              <Plus className="size-3.5" />
                              Allocate more
                            </Button>
                          )}
                      </>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="payments" className="space-y-3">
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
                              {payment.linked_expense_id && (
                                <Badge
                                  variant="secondary"
                                  className="ml-1.5 text-[10px] px-1 py-0"
                                >
                                  Synced
                                </Badge>
                              )}
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
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── BNPL Dialogs ──────────────────────────────────────── */}

      {/* Platform Form */}
      <Dialog open={platformFormOpen} onOpenChange={setPlatformFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlatform ? "Edit Platform" : "Add BNPL Platform"}
            </DialogTitle>
            <DialogDescription>
              {editingPlatform
                ? "Update platform details."
                : "Add a new BNPL or EMI platform."}
            </DialogDescription>
          </DialogHeader>
          <BnplPlatformForm
            platform={editingPlatform}
            onSubmit={addPlatform}
            onUpdate={updatePlatform}
            onSuccess={handlePlatformFormSuccess}
            onCancel={() => setPlatformFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Purchase Form */}
      <Dialog open={purchaseFormOpen} onOpenChange={setPurchaseFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add BNPL Purchase</DialogTitle>
            <DialogDescription>
              Track a new purchase with EMI schedule.
            </DialogDescription>
          </DialogHeader>
          {platforms.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                You need to add a platform first before adding a purchase.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setPurchaseFormOpen(false);
                  handleAddPlatform();
                }}
              >
                <Plus className="size-4" />
                Add Platform First
              </Button>
            </div>
          ) : (
            <BnplPurchaseForm
              platforms={platforms}
              preselectedPlatformId={preselectedPlatformId}
              autoOpenUpload={autoOpenUpload}
              onInvoicesSelected={handleInvoicesSelected}
              onSubmit={addPurchaseWithInvoices}
              onSuccess={handlePurchaseFormSuccess}
              onCancel={() => setPurchaseFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* BNPL Payment Form */}
      <Dialog open={bnplPaymentFormOpen} onOpenChange={setBnplPaymentFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay EMI</DialogTitle>
            <DialogDescription>
              Record your EMI payment.
            </DialogDescription>
          </DialogHeader>
          {payingEmiPayment && payingEmiPurchase && (
            <BnplPaymentForm
              payment={payingEmiPayment}
              itemName={payingEmiPurchase.item_name}
              platformName={payingPlatformName}
              onSubmit={payEMI}
              onSuccess={handleBnplPaymentSuccess}
              onCancel={() => setBnplPaymentFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase Detail Modal */}
      <PurchaseDetailModal
        open={purchaseDetailOpen}
        onOpenChange={setPurchaseDetailOpen}
        purchase={detailPurchase}
        platformName={detailPlatformName}
        platformColor={detailPlatformColor}
        fetchPayments={fetchBnplPayments}
        onPayEMI={handlePayEMIFromSchedule}
        onForeclose={handleForeclose}
      />

      {/* Delete Platform Confirmation */}
      <Dialog open={deletePlatformOpen} onOpenChange={setDeletePlatformOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Platform</DialogTitle>
            <DialogDescription>
              Are you sure? This will delete the platform and all its purchases
              and payment records. Linked expenses will remain.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletePlatformOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletePlatform}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Purchase Confirmation */}
      <Dialog open={deletePurchaseOpen} onOpenChange={setDeletePurchaseOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Purchase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{deletingPurchase?.item_name}</span>
              ? This will remove all EMI records and linked expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletePurchaseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletePurchase}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Payment Dialog */}
      <Dialog open={billPaymentOpen} onOpenChange={setBillPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Bill</DialogTitle>
            <DialogDescription>
              Pay the full bill amount — all unpaid EMIs in this bill will be
              marked paid.
            </DialogDescription>
          </DialogHeader>
          {payingBill && (
            <BnplBillPaymentForm
              bill={payingBill}
              platformName={payingBillPlatformName}
              onSubmit={payBill}
              onSuccess={handleBillPaymentSuccess}
              onCancel={() => setBillPaymentOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Foreclose Confirmation */}
      <Dialog open={forecloseOpen} onOpenChange={setForecloseOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Foreclose Purchase</DialogTitle>
            <DialogDescription>
              Pay off the remaining{" "}
              <span className="font-medium">
                {formatCurrency(foreclosingPurchase?.outstanding_balance ?? 0)}
              </span>{" "}
              for{" "}
              <span className="font-medium">
                {foreclosingPurchase?.item_name}
              </span>
              ? Remaining EMIs will be marked as skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setForecloseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmForeclose}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Confirm Foreclosure
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CC Statement Upload Dialog */}
      {ccStatementPlatformId && (
        <StatementUploadDialog
          open={ccStatementOpen}
          onOpenChange={setCcStatementOpen}
          creditCardId={ccStatementPlatformId}
          creditCardName={ccStatementCardName}
          onSaved={handleCcStatementSaved}
        />
      )}
    </div>
  );
}

// ── Debt Card Component ──────────────────────────────────────────────

interface DebtCardProps {
  debt: Debt;
  onLogPayment: (debt: Debt, e: React.MouseEvent) => void;
  onEdit: (debt: Debt, e: React.MouseEvent) => void;
  onDelete: (debt: Debt, e: React.MouseEvent) => void;
  onAllocate: (debt: Debt, e: React.MouseEvent) => void;
  onClick: () => void;
}

function DebtCard({
  debt,
  onLogPayment,
  onEdit,
  onDelete,
  onAllocate,
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

        <div className="space-y-1.5">
          <Progress value={percentage} />
          <p className="text-xs text-muted-foreground">
            {formatCurrency(paid)} paid of {formatCurrency(debt.original_amount)}{" "}
            ({percentage}%)
          </p>
        </div>

        {debt.emi_amount !== null && (
          <p className="text-xs text-muted-foreground">
            EMI: {formatCurrency(debt.emi_amount)}/month
            {debt.emi_day_of_month !== null &&
              ` | Due: ${debt.emi_day_of_month}${getOrdinalSuffix(debt.emi_day_of_month)}`}
            {debt.remaining_emis !== null &&
              ` | ${debt.remaining_emis} EMI${debt.remaining_emis !== 1 ? "s" : ""} remaining`}
          </p>
        )}

        {debt.interest_rate > 0 && (
          <p className="text-xs text-muted-foreground">
            Interest: {debt.interest_rate}%
          </p>
        )}

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

        {debt.status === "active" &&
          (() => {
            const unallocated =
              debt.original_amount - (debt.allocated_amount ?? 0);
            if (unallocated > 0) {
              return (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {formatCurrency(unallocated)} unallocated
                </p>
              );
            }
            if ((debt.allocated_amount ?? 0) > 0) {
              return (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Fully allocated
                </p>
              );
            }
            return null;
          })()}

        {debt.status === "active" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => onLogPayment(debt, e)}
            >
              <IndianRupee className="size-3.5" />
              Log Payment
            </Button>
            {debt.original_amount - (debt.allocated_amount ?? 0) > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={(e) => onAllocate(debt, e)}
              >
                <Plus className="size-3.5" />
                Allocate
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
