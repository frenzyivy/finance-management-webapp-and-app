"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wallet,
  Hash,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

import { useExpenses } from "@/hooks/use-expenses";
import { ExpenseForm } from "@/components/forms/expense-form";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/constants/categories";
import type { ExpenseEntry, ExpenseCategory } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ── Category color mapping ──────────────────────────────────────────────

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  credit_card_payments: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  emis: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  rent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  food_groceries: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  utilities: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  transport: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  shopping: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  health: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  education: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  entertainment: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  subscriptions: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  family_personal: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  miscellaneous: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
};

function getCategoryColor(category: ExpenseCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.miscellaneous;
}

function getCategoryLabel(category: ExpenseCategory): string {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category
  );
}

function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHODS.find((p) => p.value === method)?.label ?? method;
}

// ── Page component ──────────────────────────────────────────────────────

export default function ExpensesPage() {
  const {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    totalThisMonth,
    monthEntryCount,
    topCategory,
  } = useExpenses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<
    ExpenseCategory | "all"
  >("all");

  // Filtered entries
  const filteredEntries =
    categoryFilter === "all"
      ? entries
      : entries.filter((e) => e.category === categoryFilter);

  // Dialog handlers
  const openAddDialog = () => {
    setEditingEntry(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (entry: ExpenseEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingEntry(undefined);
    fetchEntries();
  };

  const handleFormCancel = () => {
    setDialogOpen(false);
    setEditingEntry(undefined);
  };

  // Delete handlers
  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    const { error } = await deleteEntry(deletingId);
    if (error) {
      toast.error("Failed to delete expense entry");
    } else {
      toast.success("Expense entry deleted");
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" data-icon="inline-start" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total This Month
              </CardTitle>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalThisMonth)}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entries This Month
              </CardTitle>
              <Hash className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{monthEntryCount}</p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Category
              </CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {topCategory ? (
              <div>
                <p className="text-lg font-bold">{topCategory.label}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(topCategory.amount)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
        >
          All
        </Button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={categoryFilter === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Expense Table or Empty State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16">
          <ReceiptText className="size-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">No expenses found</p>
            <p className="text-sm text-muted-foreground">
              {categoryFilter !== "all"
                ? "No entries match this category filter."
                : "Start tracking your spending by adding your first expense."}
            </p>
          </div>
          {categoryFilter === "all" && (
            <Button onClick={openAddDialog}>
              <Plus className="size-4" data-icon="inline-start" />
              Add your first expense
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium">
                    {entry.payee_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getCategoryColor(entry.category)}
                    >
                      {getCategoryLabel(entry.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>
                    {getPaymentMethodLabel(entry.payment_method)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(entry)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => confirmDelete(entry.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update the details of this expense entry."
                : "Fill in the details to record a new expense."}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            entry={editingEntry}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense entry? This action
              cannot be undone.
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
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
