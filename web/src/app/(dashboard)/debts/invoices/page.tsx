"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { FileText, Image as ImageIcon, ExternalLink, Trash2, ArrowLeft, ShoppingBag, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { useBnplParser } from "@/hooks/use-bnpl-parser";
import { formatCurrency } from "@/lib/utils/currency";
import type { BnplPurchase, BnplInvoiceFile } from "@/types/bnpl";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface PurchaseWithInvoices extends BnplPurchase {
  platform_name: string;
}

export default function InvoicesPage() {
  const [purchases, setPurchases] = useState<PurchaseWithInvoices[]>([]);
  const [loading, setLoading] = useState(true);
  const { getInvoiceUrl, deleteInvoiceFile } = useBnplParser();

  const fetchInvoices = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bnpl_purchases")
      .select("*, bnpl_platforms(name)")
      .not("invoice_files", "eq", "[]")
      .order("purchase_date", { ascending: false });

    if (error) {
      toast.error(error.message);
      setPurchases([]);
    } else {
      const rows = (data ?? [])
        .map((p) => ({
          ...(p as BnplPurchase),
          platform_name:
            (p as unknown as { bnpl_platforms?: { name?: string } }).bnpl_platforms?.name ?? "—",
        }))
        .filter((p) => (p.invoice_files ?? []).length > 0);
      setPurchases(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleView = async (path: string) => {
    const { url, error } = await getInvoiceUrl(path);
    if (error || !url) {
      toast.error(error || "Could not generate preview URL");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (purchaseId: string, path: string) => {
    if (!confirm("Delete this invoice file? The purchase record will remain.")) return;
    const { error } = await deleteInvoiceFile(purchaseId, path);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Invoice deleted");
    fetchInvoices();
  };

  const totalFiles = purchases.reduce((sum, p) => sum + (p.invoice_files?.length ?? 0), 0);

  return (
    <div className="flex flex-col">
      <div className="animate d1">
        <PageHeader
          title="Invoices"
          eyebrow={`${totalFiles} file${totalFiles === 1 ? "" : "s"} · expires 120d`}
        />
      </div>
      <div className="px-6 space-y-6">
      <Link
        href="/debts"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]"
      >
        <ArrowLeft className="size-3.5" /> Back to Debts
      </Link>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : purchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Upload invoices when adding BNPL purchases to build your archive for tax filing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {purchases.map((purchase) => (
            <Card key={purchase.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShoppingBag className="size-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{purchase.item_name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {purchase.platform_name} · {formatCurrency(purchase.total_amount)} ·{" "}
                      {format(new Date(purchase.purchase_date), "dd MMM yyyy")}
                    </CardDescription>
                  </div>
                  {purchase.order_id && (
                    <Badge variant="outline" className="text-[11px] shrink-0">
                      {purchase.order_id}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(purchase.invoice_files ?? []).map((file) => (
                  <InvoiceRow
                    key={file.path}
                    file={file}
                    onView={() => handleView(file.path)}
                    onDelete={() => handleDelete(purchase.id, file.path)}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function InvoiceRow({
  file,
  onView,
  onDelete,
}: {
  file: BnplInvoiceFile;
  onView: () => void;
  onDelete: () => void;
}) {
  const daysUntilExpiry = differenceInDays(new Date(file.expires_at), new Date());
  const isExpiringSoon = daysUntilExpiry <= 14 && daysUntilExpiry > 0;
  const isImage = file.name.match(/\.(jpg|jpeg|png)$/i);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      {isImage ? (
        <ImageIcon className="size-5 text-blue-600 shrink-0" />
      ) : (
        <FileText className="size-5 text-red-600 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
            {file.type.replace("_", " ")}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          <span>{(file.size / 1024).toFixed(1)} KB</span>
          <span>·</span>
          <span>Uploaded {format(new Date(file.uploaded_at), "dd MMM yyyy")}</span>
          <span>·</span>
          <span
            className={`flex items-center gap-1 ${
              isExpiringSoon ? "text-amber-600 dark:text-amber-400" : ""
            }`}
          >
            <Clock className="size-3" />
            {daysUntilExpiry > 0
              ? `Expires in ${daysUntilExpiry}d`
              : "Expired"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onView} className="h-8">
          <ExternalLink className="size-3.5" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
