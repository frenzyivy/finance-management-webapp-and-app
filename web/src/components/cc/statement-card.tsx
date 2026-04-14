"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  IndianRupee,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CCStatement, CCStatementTransaction } from "@/types/cc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface StatementCardProps {
  statement: CCStatement;
  onPay: (statement: CCStatement) => void;
  onViewDetails?: (statement: CCStatement) => void;
  fetchTransactions?: (statementId: string) => Promise<CCStatementTransaction[]>;
  onApproveTransactions?: (
    statementId: string,
    transactionIds: string[],
    categories?: Record<string, string>
  ) => void;
}

function getStatusBadge(status: string) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    upcoming: { label: "Upcoming", variant: "outline" },
    due: { label: "Due", variant: "default" },
    paid: { label: "Paid", variant: "secondary" },
    partially_paid: { label: "Partial", variant: "outline" },
    overdue: { label: "Overdue", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "outline" as const };
  return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function StatementCard({
  statement,
  onPay,
  onViewDetails,
  fetchTransactions,
  onApproveTransactions,
}: StatementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<CCStatementTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const paymentProgress =
    statement.total_amount_due > 0
      ? Math.min(100, Math.round((statement.amount_paid / statement.total_amount_due) * 100))
      : 0;

  const remaining = Math.max(0, statement.total_amount_due - statement.amount_paid);
  const isPaid = statement.status === "paid";

  const handleExpand = async () => {
    if (!expanded && fetchTransactions && transactions.length === 0) {
      setLoadingTxns(true);
      try {
        const txns = await fetchTransactions(statement.id);
        setTransactions(txns);
      } catch {
        // ignore
      } finally {
        setLoadingTxns(false);
      }
    }
    setExpanded(!expanded);
  };

  const unapprovedTxns = transactions.filter((t) => !t.is_approved && (t.transaction_type === "purchase" || t.transaction_type === "emi_charge"));

  return (
    <Card className={isPaid ? "opacity-75" : ""}>
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {formatDate(statement.statement_date)}
            </span>
            {getStatusBadge(statement.status)}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(statement.total_amount_due)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Min: {formatCurrency(statement.minimum_amount_due)}
            </p>
          </div>
        </div>

        {/* Due date & payment info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Due: {formatDate(statement.due_date)}</span>
          {statement.amount_paid > 0 && (
            <span>
              Paid: {formatCurrency(statement.amount_paid)}
              {remaining > 0 && ` (${formatCurrency(remaining)} remaining)`}
            </span>
          )}
        </div>

        {/* Payment progress */}
        {statement.total_amount_due > 0 && (
          <Progress value={paymentProgress} className="h-1.5" />
        )}

        {/* Interest & fees summary */}
        {(statement.interest_charged > 0 || statement.fees_charged > 0) && (
          <div className="flex gap-3 text-[10px]">
            {statement.interest_charged > 0 && (
              <span className="text-red-500">
                Interest: {formatCurrency(statement.interest_charged)}
              </span>
            )}
            {statement.fees_charged > 0 && (
              <span className="text-red-500">
                Fees: {formatCurrency(statement.fees_charged)}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {!isPaid && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onPay(statement)}
            >
              <IndianRupee className="size-3" /> Pay
            </Button>
          )}
          {fetchTransactions && (
            <button
              onClick={handleExpand}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> Hide transactions
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> View transactions
                </>
              )}
            </button>
          )}
        </div>

        {/* Expanded transaction list */}
        {expanded && (
          <div className="space-y-1 pt-1 border-t">
            {loadingTxns ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Loading transactions...
              </p>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No transactions found.
              </p>
            ) : (
              <>
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {txn.is_approved && (
                        <Check className="size-3 text-green-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {txn.merchant_name || txn.description}
                      </span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 shrink-0">
                        {txn.transaction_type}
                      </Badge>
                    </div>
                    <span
                      className={`font-medium shrink-0 ml-2 ${
                        txn.amount < 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {txn.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(txn.amount))}
                    </span>
                  </div>
                ))}

                {unapprovedTxns.length > 0 && onApproveTransactions && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs mt-1"
                    onClick={() =>
                      onApproveTransactions(
                        statement.id,
                        unapprovedTxns.map((t) => t.id)
                      )
                    }
                  >
                    <CreditCard className="size-3" />
                    Import {unapprovedTxns.length} transactions as expenses
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
