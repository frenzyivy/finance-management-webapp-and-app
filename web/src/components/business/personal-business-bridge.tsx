"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTransfers } from "@/hooks/use-transfers";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { PersonalBusinessTransfer } from "@/types/business";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogTransferForm } from "@/components/forms/log-transfer-form";

export function PersonalBusinessBridge() {
  const {
    entries,
    loading,
    fetchEntries,
    deleteEntry,
    personalToBusiness,
    businessToPersonal,
    netFlow,
  } = useTransfers();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersonalBusinessTransfer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const recentFive = entries.slice(0, 5);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete transfer");
    else toast.success("Transfer deleted (mirror entry also removed)");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Personal ↔ Business Bridge</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Money moving between personal and business accounts
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Log Transfer
        </Button>
      </CardHeader>
      <CardContent>
        {/* Flow summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3">
            <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 mb-1">
              <ArrowRight className="size-3" /> To Business
            </div>
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(personalToBusiness)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3">
            <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 mb-1">
              <ArrowLeft className="size-3" /> To Personal
            </div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(businessToPersonal)}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground mb-1">Net (this month)</div>
            <p
              className={`text-sm font-bold ${
                netFlow >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {netFlow >= 0 ? "+" : ""}
              {formatCurrency(netFlow)}
            </p>
          </div>
        </div>

        {/* Recent transfers */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentFive.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No transfers yet. Log your first one to track personal↔business money flow.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Recent Transfers
            </p>
            {recentFive.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    t.direction === "personal_to_business"
                      ? "bg-blue-50 dark:bg-blue-950"
                      : "bg-emerald-50 dark:bg-emerald-950"
                  }`}
                >
                  {t.direction === "personal_to_business" ? (
                    <ArrowRight className="size-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <ArrowLeft className="size-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.date)} •{" "}
                    {t.direction === "personal_to_business"
                      ? "Personal → Business"
                      : "Business → Personal"}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold shrink-0 ${
                    t.direction === "personal_to_business"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatCurrency(t.amount)}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleteTarget(t)}
                  className="shrink-0"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Log Transfer Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Transfer</DialogTitle>
            <DialogDescription>
              Record money moving between your personal and business accounts. A matching
              personal entry will be auto-created.
            </DialogDescription>
          </DialogHeader>
          <LogTransferForm
            onSuccess={() => {
              setFormOpen(false);
              fetchEntries();
            }}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transfer</DialogTitle>
            <DialogDescription>
              Delete this transfer for {deleteTarget ? formatCurrency(deleteTarget.amount) : ""}?
              The auto-generated personal entry will also be deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}