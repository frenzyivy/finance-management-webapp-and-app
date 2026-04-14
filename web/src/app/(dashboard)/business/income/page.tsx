"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, IndianRupee, Hash, TrendingUp, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useBusinessIncome } from "@/hooks/use-business-income";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { BUSINESS_INCOME_CATEGORIES, LANDED_IN_OPTIONS } from "@/lib/constants/business-categories";
import { PAYMENT_METHODS } from "@/lib/constants/categories";
import type { BusinessIncome } from "@/types/business";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BusinessIncomeForm } from "@/components/forms/business-income-form";

function getCategoryLabel(value: string) {
  return BUSINESS_INCOME_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getLandedInLabel(value: string) {
  return LANDED_IN_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export default function BusinessIncomePage() {
  const { entries, loading, fetchEntries, deleteEntry, totalThisMonth, monthEntryCount, avgPerEntry } = useBusinessIncome();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BusinessIncome | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BusinessIncome | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAddDialog = () => { setEditingEntry(undefined); setFormOpen(true); };
  const openEditDialog = (entry: BusinessIncome) => { setEditingEntry(entry); setFormOpen(true); };
  const handleFormSuccess = () => { setFormOpen(false); setEditingEntry(undefined); fetchEntries(); };
  const handleFormCancel = () => { setFormOpen(false); setEditingEntry(undefined); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete entry");
    else toast.success("Business income entry deleted");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Business Income</h2>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" /> Add Income
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total This Month</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalThisMonth)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entries This Month</CardTitle>
            <Hash className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{monthEntryCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg per Entry</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(avgPerEntry)}</p></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No business income yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Start tracking your business revenue.</p>
            <Button className="mt-4" onClick={openAddDialog}><Plus className="size-4" /> Add your first business income</Button>
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
                <TableHead className="hidden sm:table-cell">Landed In</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium">{entry.source_name}</TableCell>
                  <TableCell><Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{getCategoryLabel(entry.category)}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{getLandedInLabel(entry.landed_in)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(entry)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(entry)}><Trash2 className="size-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Business Income" : "Add Business Income"}</DialogTitle>
            <DialogDescription>{editingEntry ? "Update the details." : "Record a new business income entry."}</DialogDescription>
          </DialogHeader>
          <BusinessIncomeForm key={editingEntry?.id ?? "new"} entry={editingEntry} onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Business Income</DialogTitle>
            <DialogDescription>Delete &quot;{deleteTarget?.source_name}&quot; for {deleteTarget ? formatCurrency(deleteTarget.amount) : ""}? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="size-4 animate-spin" />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
