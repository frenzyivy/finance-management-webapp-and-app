"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users, IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useBusinessClients } from "@/hooks/use-business-clients";
import { formatCurrency } from "@/lib/utils/currency";
import { CLIENT_STATUSES, ENGAGEMENT_TYPES } from "@/lib/constants/business-categories";
import type { BusinessClient } from "@/types/business";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BusinessClientForm } from "@/components/forms/business-client-form";

function getStatusLabel(value: string) {
  return CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function getEngagementLabel(value: string) {
  return ENGAGEMENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

export default function BusinessClientsPage() {
  const { entries, loading, fetchEntries, deleteEntry, activeCount, totalMonthlyValue } = useBusinessClients();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BusinessClient | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BusinessClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAddDialog = () => { setEditingEntry(undefined); setFormOpen(true); };
  const openEditDialog = (entry: BusinessClient) => { setEditingEntry(entry); setFormOpen(true); };
  const handleFormSuccess = () => { setFormOpen(false); setEditingEntry(undefined); fetchEntries(); };
  const handleFormCancel = () => { setFormOpen(false); setEditingEntry(undefined); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete client");
    else toast.success("Client deleted");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Clients"
          actions={
            <Button onClick={openAddDialog}>
              <Plus className="size-4" /> Add
            </Button>
          }
        />
      </div>
      <div className="px-6 space-y-6">

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly Value</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalMonthlyValue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{entries.length}</p></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No clients yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Track your business clients and their engagements.</p>
            <Button className="mt-4" onClick={openAddDialog}><Plus className="size-4" /> Add your first client</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Industry</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Monthly Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div>
                      {entry.name}
                      {entry.country && <span className="text-xs text-muted-foreground ml-1">({entry.country})</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{entry.industry || "—"}</TableCell>
                  <TableCell>
                    {entry.engagement_type ? (
                      <Badge variant="secondary" className="text-xs">{getEngagementLabel(entry.engagement_type)}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      entry.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                      entry.status === "prospect" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                      entry.status === "paused" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    }>
                      {getStatusLabel(entry.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{entry.monthly_value ? formatCurrency(entry.monthly_value) : "—"}</TableCell>
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
            <DialogTitle>{editingEntry ? "Edit Client" : "Add Client"}</DialogTitle>
            <DialogDescription>{editingEntry ? "Update client details." : "Add a new business client."}</DialogDescription>
          </DialogHeader>
          <BusinessClientForm key={editingEntry?.id ?? "new"} entry={editingEntry} onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>Delete &quot;{deleteTarget?.name}&quot;? Income and expense records will keep the data but lose the client link.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="size-4 animate-spin" />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
