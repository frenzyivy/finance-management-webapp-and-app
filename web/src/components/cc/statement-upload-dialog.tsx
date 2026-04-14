"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  X,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";
import { useCCStatements } from "@/hooks/use-cc-statements";
import type { ParsedCCStatementData, ParsedCCTransactionData } from "@/types/cc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatementUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: string;
  creditCardName: string;
  onSaved?: () => void;
}

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/jpg,image/png";
const MAX_SIZE = 10 * 1024 * 1024;

type TransactionWithSelection = ParsedCCTransactionData & {
  _selected: boolean;
  _categoryOverride: string | null;
};

export function StatementUploadDialog({
  open,
  onOpenChange,
  creditCardId,
  creditCardName,
  onSaved,
}: StatementUploadDialogProps) {
  const { parsing, saving, parseStatement, saveStatement } = useCCStatements();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCCStatementData | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithSelection[]>([]);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setParsedData(null);
    setTransactions([]);
    setShowAllTxns(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (parsing || saving) return;
    reset();
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error(`${f.name} exceeds 10 MB limit`);
      return;
    }
    setFile(f);
    setParsedData(null);
    setTransactions([]);
  };

  const handleParse = async () => {
    if (!file) return;
    const { data, error } = await parseStatement(file);
    if (error || !data) {
      toast.error(error || "Could not parse statement");
      return;
    }
    setParsedData(data);

    // Initialize transactions with selection state
    const txnsWithState: TransactionWithSelection[] = (data.transactions || []).map((t) => ({
      ...t,
      // Auto-select purchases and EMI charges for expense import
      _selected: t.transaction_type === "purchase" || t.transaction_type === "emi_charge",
      _categoryOverride: null,
    }));
    setTransactions(txnsWithState);

    if (data.warnings.length > 0) {
      toast.warning(`Parsed with ${data.warnings.length} warning(s)`, {
        description: data.warnings[0],
      });
    } else {
      toast.success(`Parsed ${txnsWithState.length} transactions`);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;

    const validTxns = transactions
      .filter((t) => t.description && t.amount !== null && t.transaction_date)
      .map((t) => ({
        transaction_date: t.transaction_date!,
        posting_date: t.posting_date,
        description: t.description!,
        reference: t.reference,
        merchant_name: t.merchant_name,
        amount: t.amount!,
        transaction_type: t.transaction_type,
        category: t._categoryOverride || t.category,
      }));

    const { data, error } = await saveStatement({
      credit_card_id: creditCardId,
      statement_date: parsedData.statement_date || new Date().toISOString().split("T")[0],
      due_date: parsedData.due_date || new Date().toISOString().split("T")[0],
      billing_period_start: parsedData.billing_period_start,
      billing_period_end: parsedData.billing_period_end,
      total_amount_due: parsedData.total_amount_due || 0,
      minimum_amount_due: parsedData.minimum_amount_due || 0,
      previous_balance: parsedData.previous_balance || 0,
      payments_received: parsedData.payments_received || 0,
      new_charges: parsedData.new_charges || 0,
      interest_charged: parsedData.interest_charged || 0,
      fees_charged: parsedData.fees_charged || 0,
      credit_limit: parsedData.credit_limit,
      available_credit: parsedData.available_credit,
      transactions: validTxns,
    });

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(`Statement saved with ${data?.transactions_count || 0} transactions`);
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  const toggleTransaction = (index: number) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, _selected: !t._selected } : t))
    );
  };

  const toggleAllTransactions = (selected: boolean) => {
    setTransactions((prev) => prev.map((t) => ({ ...t, _selected: selected })));
  };

  const updateCategory = (index: number, category: string) => {
    setTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, _categoryOverride: category } : t))
    );
  };

  const selectedCount = transactions.filter((t) => t._selected).length;
  const displayTxns = showAllTxns ? transactions : transactions.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-blue-600" />
            Upload Credit Card Statement
          </DialogTitle>
          <DialogDescription>
            Upload your {creditCardName} statement PDF and we&apos;ll extract all
            transactions. Nothing is stored until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* File Upload */}
          {!parsedData && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Statement PDF <span className="text-destructive">*</span>
              </label>
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                  <FileText className="size-5 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-md p-1 hover:bg-muted"
                  >
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-4 py-6 text-center transition-colors hover:border-ring hover:bg-muted/30"
                >
                  <Upload className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop credit card statement PDF, or click to browse
                  </p>
                  <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG - Max 10 MB</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <AlertTriangle className="inline size-3 mr-1 text-amber-500" />
                File is parsed locally and never stored. Only approved data is saved.
              </p>
            </div>
          )}

          {/* Parsed Statement Summary */}
          {parsedData && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-3.5 text-blue-600" />
                Statement Summary
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <span className="text-muted-foreground">Statement Date: </span>
                  <span className="font-medium">{parsedData.statement_date || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date: </span>
                  <span className="font-medium">{parsedData.due_date || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Due: </span>
                  <span className="font-semibold text-red-600">
                    {parsedData.total_amount_due != null
                      ? formatCurrency(parsedData.total_amount_due)
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Minimum Due: </span>
                  <span className="font-medium">
                    {parsedData.minimum_amount_due != null
                      ? formatCurrency(parsedData.minimum_amount_due)
                      : "—"}
                  </span>
                </div>
                {parsedData.credit_limit != null && (
                  <div>
                    <span className="text-muted-foreground">Credit Limit: </span>
                    <span>{formatCurrency(parsedData.credit_limit)}</span>
                  </div>
                )}
                {parsedData.interest_charged != null && parsedData.interest_charged > 0 && (
                  <div>
                    <span className="text-muted-foreground">Interest: </span>
                    <span className="text-red-500">
                      {formatCurrency(parsedData.interest_charged)}
                    </span>
                  </div>
                )}
              </div>
              {parsedData.warnings.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2 mt-1">
                  <AlertTriangle className="inline size-3 mr-1" />
                  {parsedData.warnings[0]}
                </div>
              )}
            </div>
          )}

          {/* Transactions List */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Transactions ({transactions.length})
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedCount} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => toggleAllTransactions(selectedCount < transactions.length)}
                  >
                    {selectedCount < transactions.length ? "Select All" : "Deselect All"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {displayTxns.map((txn, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                      txn._selected ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : ""
                    }`}
                  >
                    <Checkbox
                      checked={txn._selected}
                      onCheckedChange={() => toggleTransaction(idx)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <TransactionTypeBadge type={txn.transaction_type} />
                        <span className="truncate font-medium text-xs">
                          {txn.merchant_name || txn.description || "Unknown"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {txn.transaction_date} - {txn.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-semibold ${
                          (txn.amount || 0) < 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {txn.amount != null
                          ? (txn.amount < 0 ? "-" : "+") + formatCurrency(Math.abs(txn.amount))
                          : "—"}
                      </p>
                    </div>
                    {txn._selected && txn.transaction_type === "purchase" && (
                      <Select
                        value={txn._categoryOverride || txn.category || "miscellaneous"}
                        onValueChange={(v) => v && updateCategory(idx, v)}
                      >
                        <SelectTrigger className="w-[100px] h-6 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>

              {transactions.length > 10 && (
                <button
                  onClick={() => setShowAllTxns(!showAllTxns)}
                  className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllTxns ? (
                    <>
                      <ChevronUp className="size-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3" /> Show all {transactions.length} transactions
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={parsing || saving}>
              Cancel
            </Button>
            {!parsedData ? (
              <Button onClick={handleParse} disabled={!file || parsing}>
                {parsing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Parse Statement
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Save Statement
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransactionTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    purchase: { label: "Purchase", variant: "default" },
    refund: { label: "Refund", variant: "secondary" },
    fee: { label: "Fee", variant: "destructive" },
    interest: { label: "Interest", variant: "destructive" },
    payment: { label: "Payment", variant: "secondary" },
    cashback: { label: "Cashback", variant: "secondary" },
    emi_charge: { label: "EMI", variant: "outline" },
  };
  const c = config[type] || { label: type, variant: "outline" as const };
  return (
    <Badge variant={c.variant} className="text-[9px] px-1 py-0 h-4">
      {c.label}
    </Badge>
  );
}
