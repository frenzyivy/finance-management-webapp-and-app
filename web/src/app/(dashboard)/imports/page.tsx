"use client";

import { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileUp,
  Check,
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useImportedTransactions } from "@/hooks/use-imported-transactions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/constants/categories";
import type { ImportedTransaction } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportsPage() {
  const {
    entries,
    loading,
    pendingCount,
    totalDebits,
    totalCredits,
    approveEntries,
    rejectEntries,
    uploadStatement,
    clearPending,
  } = useImportedTransactions();

  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [payeeMap, setPayeeMap] = useState<Record<string, string>>({});
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingEntries = useMemo(
    () => entries.filter((e) => e.status === "pending"),
    [entries]
  );
  const processedEntries = useMemo(
    () => entries.filter((e) => e.status !== "pending"),
    [entries]
  );

  // ── File Upload ──

  async function handleFile(file: File) {
    const validTypes = [
      "text/csv",
      "application/pdf",
      "application/vnd.ms-excel",
    ];
    const validExts = [".csv", ".pdf"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      toast.error("Please upload a CSV or PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setUploading(true);
    const { data, error } = await uploadStatement(file);
    setUploading(false);

    if (error) {
      toast.error(error);
    } else if (data) {
      toast.success(
        `Parsed ${data.total} transactions (${data.pending} new${data.duplicates > 0 ? `, ${data.duplicates} duplicates` : ""})`
      );
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  // ── Selection ──

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === pendingEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEntries.map((e) => e.id)));
    }
  }

  // ── Approve / Reject ──

  async function handleApproveSelected() {
    const items = pendingEntries
      .filter((e) => selectedIds.has(e.id))
      .map((e) => ({
        id: e.id,
        assigned_category: categoryMap[e.id] || (e.parsed_type === "debit" ? "miscellaneous" : "other"),
        assigned_payee_name: payeeMap[e.id] || e.parsed_description || undefined,
        assigned_payment_method: paymentMethodMap[e.id] || "upi",
      }));

    if (items.length === 0) {
      toast.error("Select transactions to approve");
      return;
    }

    setApproving(true);
    const { error } = await approveEntries(items);
    setApproving(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success(`Approved ${items.length} transactions`);
      setSelectedIds(new Set());
    }
  }

  async function handleRejectSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Select transactions to reject");
      return;
    }

    await rejectEntries(ids);
    toast.success(`Rejected ${ids.length} transactions`);
    setSelectedIds(new Set());
  }

  function getCategoryOptions(type: "debit" | "credit") {
    return type === "debit" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-muted-foreground">
          Upload bank statements to import transactions automatically
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Debits (Pending)
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalDebits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Credits (Pending)
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCredits)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Bank Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? "border-teal-500 bg-teal-50 dark:bg-teal-950"
                : "border-muted-foreground/25 hover:border-teal-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              {uploading
                ? "Parsing your statement..."
                : "Drag and drop your bank statement here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports PDF and CSV (max 10MB)
            </p>
            <Button
              variant="outline"
              className="mt-4"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
        <div className="text-sm">
          <p className="font-medium text-green-800 dark:text-green-300">
            Your data stays private
          </p>
          <ul className="mt-1 space-y-0.5 text-green-700 dark:text-green-400">
            <li>Your PDF is parsed locally on your machine — never uploaded to any cloud service</li>
            <li>Pending transactions are stored only in your browser until you approve them</li>
            <li>Rejected transactions are deleted instantly — they never leave your device</li>
          </ul>
        </div>
      </div>

      {/* Review Queue */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Review{" "}
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed">Processed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <FileUp className="h-12 w-12 mb-4" />
                <p>No pending transactions</p>
                <p className="text-sm">Upload a bank statement to get started</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Batch Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleApproveSelected}
                  disabled={selectedIds.size === 0 || approving}
                >
                  {approving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Approve Selected ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRejectSelected}
                  disabled={selectedIds.size === 0}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject Selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearPending();
                    setSelectedIds(new Set());
                    toast.success("Cleared all pending transactions from browser");
                  }}
                  className="ml-auto text-muted-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Pending
                </Button>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={
                              selectedIds.size === pendingEntries.length &&
                              pendingEntries.length > 0
                            }
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payee/Source</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEntries.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(txn.id)}
                              onChange={() => toggleSelect(txn.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(txn.parsed_date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={txn.parsed_type === "debit" ? "destructive" : "default"}
                              className={
                                txn.parsed_type === "credit"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : ""
                              }
                            >
                              {txn.parsed_type === "debit" ? "Expense" : "Income"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(txn.parsed_amount)}
                          </TableCell>
                          <TableCell className="max-w-48 truncate" title={txn.parsed_description ?? ""}>
                            {txn.parsed_description || txn.parsed_reference || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={categoryMap[txn.id] || ""}
                              onValueChange={(v) => {
                                if (v) setCategoryMap((prev) => ({ ...prev, [txn.id]: v }));
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getCategoryOptions(txn.parsed_type).map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="w-36"
                              placeholder={txn.parsed_description || "Payee"}
                              value={payeeMap[txn.id] ?? ""}
                              onChange={(e) =>
                                setPayeeMap((prev) => ({
                                  ...prev,
                                  [txn.id]: e.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={paymentMethodMap[txn.id] || "upi"}
                              onValueChange={(v) => {
                                if (v) setPaymentMethodMap((prev) => ({
                                  ...prev,
                                  [txn.id]: v,
                                }));
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHODS.map((pm) => (
                                  <SelectItem key={pm.value} value={pm.value}>
                                    {pm.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {txn.import_source === "sms"
                                ? "SMS"
                                : txn.import_source === "bank_statement_csv"
                                ? "CSV"
                                : "PDF"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="processed">
          {processedEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <p>No processed transactions yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedEntries.map((txn) => (
                      <TableRow key={txn.id} className="opacity-70">
                        <TableCell className="whitespace-nowrap">
                          {formatDate(txn.parsed_date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={txn.parsed_type === "debit" ? "destructive" : "default"}
                            className={
                              txn.parsed_type === "credit"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : ""
                            }
                          >
                            {txn.parsed_type === "debit" ? "Expense" : "Income"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(txn.parsed_amount)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">
                          {txn.parsed_description || txn.parsed_reference || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              txn.status === "imported"
                                ? "default"
                                : txn.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                            className={
                              txn.status === "imported"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : txn.status === "duplicate"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                : ""
                            }
                          >
                            {txn.status === "imported"
                              ? "Imported"
                              : txn.status === "rejected"
                              ? "Rejected"
                              : "Duplicate"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {txn.import_source === "sms"
                              ? "SMS"
                              : txn.import_source === "bank_statement_csv"
                              ? "CSV"
                              : "PDF"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
