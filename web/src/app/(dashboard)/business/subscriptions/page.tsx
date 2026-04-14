"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CalendarClock, IndianRupee, Star, Loader2, List, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { useBusinessSubscriptions } from "@/hooks/use-business-subscriptions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { SUBSCRIPTION_CATEGORIES, BILLING_CYCLES } from "@/lib/constants/business-categories";
import type { BusinessSubscription, BusinessSubscriptionWithSpend } from "@/types/business";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessSubscriptionForm } from "@/components/forms/business-subscription-form";
import { SubscriptionCalendar } from "@/components/business/subscription-calendar";

function getCategoryLabel(value: string) {
  return SUBSCRIPTION_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getBillingLabel(value: string) {
  return BILLING_CYCLES.find((c) => c.value === value)?.label ?? value;
}

function getRenewalUrgency(renewalDate: string): { label: string; className: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  const diffDays = Math.round((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (diffDays === 0) return { label: "Due today", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (diffDays === 1) return { label: "Tomorrow", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" };
  if (diffDays <= 3) return { label: `In ${diffDays} days`, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" };
  if (diffDays <= 7) return { label: `In ${diffDays} days`, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
  return null;
}

export default function BusinessSubscriptionsPage() {
  const { entries, loading, fetchEntries, deleteEntry, activeCount, monthlyBurn, actualSpendMtd, essentialCount, nonEssentialCount } = useBusinessSubscriptions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BusinessSubscription | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<BusinessSubscriptionWithSpend | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAddDialog = () => { setEditingEntry(undefined); setFormOpen(true); };
  const openEditDialog = (entry: BusinessSubscriptionWithSpend) => { setEditingEntry(entry); setFormOpen(true); };
  const handleFormSuccess = () => { setFormOpen(false); setEditingEntry(undefined); fetchEntries(); };
  const handleFormCancel = () => { setFormOpen(false); setEditingEntry(undefined); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEntry(deleteTarget.id);
    if (error) toast.error("Failed to delete subscription");
    else toast.success("Subscription deleted");
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Subscriptions</h2>
        <Button onClick={openAddDialog}><Plus className="size-4" /> Add Subscription</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Burn</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(monthlyBurn)}</p>
            <p className="text-xs text-muted-foreground mt-1">Planned (monthly equiv.)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actual Spend (MTD)</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(actualSpendMtd)}</p>
            <p className="text-xs text-muted-foreground mt-1">Linked business expenses this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Annual Projection</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(monthlyBurn * 12)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">{essentialCount} essential, {nonEssentialCount} nice-to-have</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{entries.length}</p></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No subscriptions yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Track your SaaS tools and recurring services.</p>
            <Button className="mt-4" onClick={openAddDialog}><Plus className="size-4" /> Add your first subscription</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5"><List className="size-3.5" /> List</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="size-3.5" /> Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Monthly Equiv.</TableHead>
                    <TableHead className="text-right">Actual (MTD)</TableHead>
                    <TableHead className="hidden md:table-cell">Next Renewal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const urgency = entry.status === "active" ? getRenewalUrgency(entry.next_renewal_date) : null;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/business/expenses?subscription_id=${entry.id}`}
                            className="hover:underline"
                            title="View linked expenses"
                          >
                            {entry.name}
                          </Link>
                          {entry.is_essential && <Star className="inline ml-1 size-3 text-amber-500" />}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{getCategoryLabel(entry.category)}</Badge></TableCell>
                        <TableCell className="text-xs">{getBillingLabel(entry.billing_cycle)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.cost_amount)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-muted-foreground">{formatCurrency(entry.monthly_equivalent)}/mo</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={
                              entry.actual_spend_mtd === 0 ? "text-muted-foreground" :
                              entry.actual_spend_mtd > entry.monthly_equivalent ? "text-red-600 dark:text-red-400 font-medium" :
                              "font-medium"
                            }>
                              {formatCurrency(entry.actual_spend_mtd)}
                            </span>
                            {entry.expense_count_mtd > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {entry.expense_count_mtd} expense{entry.expense_count_mtd !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs">{formatDate(entry.next_renewal_date)}</span>
                            {urgency && (
                              <Badge className={`${urgency.className} text-[10px] w-fit`}>{urgency.label}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            entry.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                            entry.status === "trial" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                            entry.status === "paused" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                            "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          }>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(entry)}><Pencil className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(entry)}><Trash2 className="size-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <SubscriptionCalendar subscriptions={entries} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Subscription" : "Add Subscription"}</DialogTitle>
            <DialogDescription>{editingEntry ? "Update subscription details." : "Add a new SaaS tool or service."}</DialogDescription>
          </DialogHeader>
          <BusinessSubscriptionForm key={editingEntry?.id ?? "new"} entry={editingEntry} onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Subscription</DialogTitle>
            <DialogDescription>Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.</DialogDescription>
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
