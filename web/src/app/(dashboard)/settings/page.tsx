"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  Download,
  CreditCard as CreditCardIcon,
  User,
  Shield,
  Database,
  Target,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUser } from "@/hooks/use-user";
import { formatCurrency } from "@/lib/utils/currency";
import { EXPENSE_CATEGORIES } from "@/lib/constants/categories";
import type {
  Profile,
  BudgetLimit,
  CreditCard,
  ExpenseCategory,
} from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Constants ───────────────────────────────────────────────────────────

const CURRENCIES = [
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
] as const;

// ── Profile Tab ─────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useUser();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? "");
          setCurrency(data.currency ?? "INR");
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ name, currency, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated successfully");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal details and preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground rounded-lg border border-input bg-muted/50 px-2.5 py-1.5">
            {user?.email ?? "—"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={(val) => val && setCurrency(val)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Budget Limits Tab ───────────────────────────────────────────────────

function BudgetLimitsTab() {
  const { user } = useUser();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("budget_limits")
      .select("*")
      .eq("user_id", user.id);

    if (data) {
      const limitsMap: Record<string, string> = {};
      const idsMap: Record<string, string> = {};
      data.forEach((bl: BudgetLimit) => {
        limitsMap[bl.category] = String(bl.monthly_limit);
        idsMap[bl.category] = bl.id;
      });
      setLimits(limitsMap);
      setExistingIds(idsMap);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const handleSaveRow = async (category: string) => {
    if (!user) return;
    const value = limits[category];
    if (!value || isNaN(Number(value)) || Number(value) <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    setSavingRow(category);
    const supabase = createClient();

    if (existingIds[category]) {
      const { error } = await supabase
        .from("budget_limits")
        .update({
          monthly_limit: Number(value),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingIds[category]);
      if (error) {
        toast.error("Failed to update budget limit");
      } else {
        toast.success("Budget limit updated");
      }
    } else {
      const { data, error } = await supabase
        .from("budget_limits")
        .insert({
          user_id: user.id,
          category: category as ExpenseCategory,
          monthly_limit: Number(value),
        })
        .select()
        .single();
      if (error) {
        toast.error("Failed to save budget limit");
      } else {
        if (data) {
          setExistingIds((prev) => ({ ...prev, [category]: data.id }));
        }
        toast.success("Budget limit saved");
      }
    }
    setSavingRow(null);
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("budget_limits")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to clear budget limits");
    } else {
      setLimits({});
      setExistingIds({});
      toast.success("All budget limits cleared");
    }
    setClearing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Budget Limits</CardTitle>
        <CardDescription>
          Set spending limits for each category. You will be alerted when you
          approach or exceed these limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Monthly Limit</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TableRow key={cat.value}>
                <TableCell className="font-medium">{cat.label}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="No limit set"
                    value={limits[cat.value] ?? ""}
                    onChange={(e) =>
                      setLimits((prev) => ({
                        ...prev,
                        [cat.value]: e.target.value,
                      }))
                    }
                    className="ml-auto w-36 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveRow(cat.value)}
                    disabled={savingRow === cat.value}
                  >
                    {savingRow === cat.value ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Separator className="my-4" />

        <Button
          variant="destructive"
          onClick={handleClearAll}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {clearing ? "Clearing..." : "Clear All Limits"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Credit Cards Tab ────────────────────────────────────────────────────

function CreditCardsTab() {
  const { user } = useUser();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [cardName, setCardName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const fetchCards = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setCards(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const resetForm = () => {
    setCardName("");
    setLastFour("");
    setBillingDay("");
    setCreditLimit("");
    setEditingCard(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setCardName(card.card_name);
    setLastFour(card.last_four_digits);
    setBillingDay(String(card.billing_cycle_day));
    setCreditLimit(card.credit_limit ? String(card.credit_limit) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!cardName.trim()) {
      toast.error("Card name is required");
      return;
    }
    if (!lastFour || lastFour.length !== 4 || !/^\d{4}$/.test(lastFour)) {
      toast.error("Last 4 digits must be exactly 4 numbers");
      return;
    }
    const dayNum = Number(billingDay);
    if (!billingDay || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      toast.error("Billing cycle day must be between 1 and 31");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      card_name: cardName.trim(),
      last_four_digits: lastFour,
      billing_cycle_day: dayNum,
      credit_limit: creditLimit ? Number(creditLimit) : 0,
      updated_at: new Date().toISOString(),
    };

    if (editingCard) {
      const { error } = await supabase
        .from("credit_cards")
        .update(payload)
        .eq("id", editingCard.id);
      if (error) {
        toast.error("Failed to update card");
      } else {
        toast.success("Card updated");
        setDialogOpen(false);
        resetForm();
        fetchCards();
      }
    } else {
      const { error } = await supabase
        .from("credit_cards")
        .insert({ ...payload, user_id: user.id });
      if (error) {
        toast.error("Failed to add card");
      } else {
        toast.success("Card added");
        setDialogOpen(false);
        resetForm();
        fetchCards();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!cardToDelete) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("credit_cards")
      .delete()
      .eq("id", cardToDelete.id);

    if (error) {
      toast.error("Failed to delete card");
    } else {
      toast.success("Card deleted");
      setDeleteDialogOpen(false);
      setCardToDelete(null);
      fetchCards();
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Credit Cards</CardTitle>
          <CardDescription>
            Manage your credit cards for expense tracking. No sensitive card data
            is stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CreditCardIcon className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No credit cards added yet.</p>
              <Button className="mt-4" onClick={openAdd}>
                <Plus className="size-4" />
                Add Your First Card
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <Button onClick={openAdd}>
                  <Plus className="size-4" />
                  Add Card
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Card Name</TableHead>
                    <TableHead>Card Number</TableHead>
                    <TableHead className="text-right">Billing Day</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">
                        {card.card_name}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        &bull;&bull;&bull;&bull; {card.last_four_digits}
                      </TableCell>
                      <TableCell className="text-right">
                        {card.billing_cycle_day}
                      </TableCell>
                      <TableCell className="text-right">
                        {card.credit_limit
                          ? formatCurrency(card.credit_limit)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => openEdit(card)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setCardToDelete(card);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "Edit Credit Card" : "Add Credit Card"}
            </DialogTitle>
            <DialogDescription>
              {editingCard
                ? "Update your card details below."
                : "Add a new credit card for expense tracking."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-name">Card Name</Label>
              <Input
                id="card-name"
                placeholder="e.g. HDFC Millennia"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last-four">Last 4 Digits</Label>
              <Input
                id="last-four"
                placeholder="1234"
                maxLength={4}
                value={lastFour}
                onChange={(e) =>
                  setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-day">Billing Cycle Day (1-31)</Label>
              <Input
                id="billing-day"
                type="number"
                min="1"
                max="31"
                placeholder="1"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit-limit">Credit Limit (optional)</Label>
              <Input
                id="credit-limit"
                type="number"
                min="0"
                placeholder="100000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "Saving..." : editingCard ? "Update Card" : "Add Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credit Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{cardToDelete?.card_name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Data & Export Tab ───────────────────────────────────────────────────

function DataExportTab() {
  const { user } = useUser();
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingIncome, setExportingIncome] = useState(false);
  const [exportingExpenses, setExportingExpenses] = useState(false);
  const [exportingGoals, setExportingGoals] = useState(false);
  const [exportingDebts, setExportingDebts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastGenResult, setLastGenResult] = useState<{
    entries_created: number;
  } | null>(null);

  const handleGenerateRecurring = async () => {
    if (!user) return;
    setGenerating(true);
    setLastGenResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("generate_recurring_entries");
      if (error) throw error;
      setLastGenResult(data as { entries_created: number });
      const count = (data as { entries_created: number })?.entries_created ?? 0;
      if (count > 0) {
        toast.success(`${count} recurring ${count === 1 ? "entry" : "entries"} generated`);
      } else {
        toast.info("No recurring entries due today");
      }
    } catch {
      toast.error("Failed to generate recurring entries");
    }
    setGenerating(false);
  };

  function downloadCSV(filename: string, csvContent: string) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function arrayToCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }

  const exportTable = async (
    tableName: string,
    filename: string,
    setLoading: (v: boolean) => void
  ) => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info(`No ${filename.replace(/_/g, " ")} data to export`);
        setLoading(false);
        return;
      }

      const csv = arrayToCSV(data);
      downloadCSV(`${filename}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(`${filename.replace(/_/g, " ")} exported successfully`);
    } catch {
      toast.error(`Failed to export ${filename.replace(/_/g, " ")}`);
    }
    setLoading(false);
  };

  const exportAll = async () => {
    if (!user) return;
    setExportingAll(true);
    try {
      const supabase = createClient();
      const tables = [
        "income_entries",
        "expense_entries",
        "savings_goals",
        "debts",
      ];
      let allCSV = "";

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", user.id);

        if (data && data.length > 0) {
          allCSV += `\n--- ${table.toUpperCase()} ---\n`;
          allCSV += arrayToCSV(data);
          allCSV += "\n";
        }
      }

      if (!allCSV.trim()) {
        toast.info("No data to export");
        setExportingAll(false);
        return;
      }

      downloadCSV(
        `komalfin_all_data_${new Date().toISOString().slice(0, 10)}.csv`,
        allCSV
      );
      toast.success("All data exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
    setExportingAll(false);
  };

  return (
    <div className="space-y-6">
      {/* Recurring Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recurring Entries</CardTitle>
          <CardDescription>
            Automatically generate income and expense entries from your recurring templates.
            This runs daily at midnight IST, but you can trigger it manually here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerateRecurring} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {generating ? "Generating..." : "Generate Now"}
            </Button>
            {lastGenResult && (
              <p className="text-sm text-muted-foreground">
                {lastGenResult.entries_created > 0
                  ? `${lastGenResult.entries_created} ${lastGenResult.entries_created === 1 ? "entry" : "entries"} created`
                  : "All caught up — no entries due"}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Entries marked as recurring will auto-generate new entries on their due dates.
            Auto-generated entries show an &quot;Auto&quot; badge in your transaction lists.
          </p>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Export</CardTitle>
          <CardDescription>
            Download your financial data as CSV files for backup or analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Button onClick={exportAll} disabled={exportingAll}>
            {exportingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exportingAll ? "Exporting..." : "Export All Data as CSV"}
          </Button>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-3">Export by Category</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() =>
                exportTable("income_entries", "income", setExportingIncome)
              }
              disabled={exportingIncome}
            >
              {exportingIncome ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportingIncome ? "Exporting..." : "Export Income"}
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                exportTable("expense_entries", "expenses", setExportingExpenses)
              }
              disabled={exportingExpenses}
            >
              {exportingExpenses ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportingExpenses ? "Exporting..." : "Export Expenses"}
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                exportTable("savings_goals", "goals", setExportingGoals)
              }
              disabled={exportingGoals}
            >
              {exportingGoals ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportingGoals ? "Exporting..." : "Export Goals"}
            </Button>

            <Button
              variant="outline"
              onClick={() => exportTable("debts", "debts", setExportingDebts)}
              disabled={exportingDebts}
            >
              {exportingDebts ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportingDebts ? "Exporting..." : "Export Debts"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

// ── Account Tab ─────────────────────────────────────────────────────────

function AccountTab() {
  const { user } = useUser();
  const [sendingReset, setSendingReset] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);

    if (error) {
      toast.error("Failed to send reset email");
    } else {
      toast.success("Password reset email sent");
    }
    setSendingReset(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const supabase = createClient();

    try {
      // Delete all user data from all tables
      const tables = [
        "debt_payments",
        "savings_contributions",
        "expense_entries",
        "income_entries",
        "credit_cards",
        "budget_limits",
        "savings_goals",
        "debts",
        "profiles",
      ];

      for (const table of tables) {
        await supabase.from(table).delete().eq("user_id", user.id);
      }

      // Profiles uses "id" not "user_id"
      await supabase.from("profiles").delete().eq("id", user.id);

      // Sign out and redirect
      await supabase.auth.signOut();
      toast.success("Account data deleted. Signing you out...");
      window.location.href = "/login";
    } catch {
      toast.error("Failed to delete account data");
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            We will send a password reset link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleResetPassword}
            disabled={sendingReset}
          >
            {sendingReset ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shield className="size-4" />
            )}
            {sendingReset ? "Sending..." : "Send Password Reset Email"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account and data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive mb-1">
              Delete Account
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. All your data will be permanently
              deleted, including income, expenses, goals, debts, credit cards,
              and budget limits.
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all your data. This action cannot be
              undone. Type <strong>DELETE</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Confirmation</Label>
            <Input
              id="delete-confirm"
              placeholder='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Notifications Tab ──────────────────────────────────────────────────

function NotificationsTab() {
  const { user } = useUser();
  const [reminderDays, setReminderDays] = useState("5");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExistingRow, setHasExistingRow] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setReminderDays(String(data.reminder_days_before));
          setRemindersEnabled(data.reminders_enabled);
          setHasExistingRow(true);
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const days = Number(reminderDays);
    if (isNaN(days) || days < 1 || days > 30) {
      toast.error("Reminder days must be between 1 and 30");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      reminder_days_before: days,
      reminders_enabled: remindersEnabled,
      updated_at: new Date().toISOString(),
    };

    if (hasExistingRow) {
      const { error } = await supabase
        .from("notification_preferences")
        .update(payload)
        .eq("user_id", user.id);
      if (error) {
        toast.error("Failed to save notification preferences");
      } else {
        toast.success("Notification preferences updated");
      }
    } else {
      const { error } = await supabase
        .from("notification_preferences")
        .insert({ ...payload, user_id: user.id });
      if (error) {
        toast.error("Failed to save notification preferences");
      } else {
        setHasExistingRow(true);
        toast.success("Notification preferences saved");
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Reminders</CardTitle>
        <CardDescription>
          Configure when you want to be reminded about upcoming EMI payments.
          Reminders appear as a notification badge in the header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Enable Reminders</p>
            <p className="text-xs text-muted-foreground">
              Show upcoming payment reminders in the notification bell
            </p>
          </div>
          <Button
            variant={remindersEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setRemindersEnabled(!remindersEnabled)}
          >
            {remindersEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reminder-days">Remind me before (days)</Label>
          <p className="text-xs text-muted-foreground">
            You will see reminders for payments due within this many days.
          </p>
          <Input
            id="reminder-days"
            type="number"
            min="1"
            max="30"
            value={reminderDays}
            onChange={(e) => setReminderDays(e.target.value)}
            className="w-24"
            disabled={!remindersEnabled}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader title="Settings" eyebrow="Account & preferences" />
      </div>
      <div className="px-6 space-y-6">

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">
            <User className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="budget">
            <Target className="size-4" />
            Budget Limits
          </TabsTrigger>
          <TabsTrigger value="cards">
            <CreditCardIcon className="size-4" />
            Credit Cards
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="export">
            <Database className="size-4" />
            Data & Export
          </TabsTrigger>
          <TabsTrigger value="account">
            <Shield className="size-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetLimitsTab />
        </TabsContent>
        <TabsContent value="cards">
          <CreditCardsTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="export">
          <DataExportTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
