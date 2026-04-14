"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  IndianRupee,
  Hash,
  TrendingUp,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useIncome } from "@/hooks/use-income";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants/categories";
import type { IncomeEntry } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IncomeForm } from "@/components/forms/income-form";

function getCategoryLabel(value: string) {
  return INCOME_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getPaymentMethodLabel(value: string) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export default function IncomePage() {
  const {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    totalThisMonth,
    monthEntryCount,
    avgPerEntry,
  } = useIncome();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = useState<IncomeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAddDialog = () => {
    setEditingEntry(undefined);
    setFormOpen(true);
  };

  const openEditDialog = (entry: IncomeEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingEntry(undefined);
    fetchEntries();
  };

  const handleFormCancel = () => {
    setFormOpen(false);
    setEditingEntry(undefined);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      toast.success("Income entry deleted");
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Income</h2>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" />
          Add Income
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total This Month
            </CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalThisMonth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entries This Month
            </CardTitle>
            <Hash className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{monthEntryCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average per Entry
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(avgPerEntry)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table / Empty State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No income entries yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start tracking your income by adding your first entry.
            </p>
            <Button className="mt-4" onClick={openAddDialog}>
              <Plus className="size-4" />
              Add your first income entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Payment Method
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium">
                    {entry.source_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                        {getCategoryLabel(entry.category)}
                      </Badge>
                      {entry.is_auto_generated && (
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 text-[10px]"
                        >
                          Auto
                        </Badge>
                      )}
                      {entry.is_recurring && !entry.is_auto_generated && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 text-[10px]"
                        >
                          Recurring
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {getPaymentMethodLabel(entry.payment_method)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
                        onClick={() => setDeleteTarget(entry)}
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
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Income Entry" : "Add Income Entry"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update the details of this income entry."
                : "Fill in the details to record a new income entry."}
            </DialogDescription>
          </DialogHeader>
          <IncomeForm
            key={editingEntry?.id ?? "new"}
            entry={editingEntry}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Income Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the entry &quot;
              {deleteTarget?.source_name}&quot; for{" "}
              {deleteTarget ? formatCurrency(deleteTarget.amount) : ""}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
