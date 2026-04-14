"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CCStatement,
  CCStatementWithTransactions,
  ParsedCCStatementData,
} from "@/types/cc";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useCCStatements() {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState<CCStatement[]>([]);

  /** Parse a credit card statement PDF via the backend. */
  const parseStatement = async (
    file: File
  ): Promise<{ data: ParsedCCStatementData | null; error: string | null }> => {
    setParsing(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { data: null, error: "Not authenticated" };

      const formData = new FormData();
      formData.append("statement_file", file);

      const res = await fetch(`${API_BASE}/api/cc/parse-statement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.detail || `Request failed (${res.status})` };
      }

      const json = await res.json();
      return { data: json.data as ParsedCCStatementData, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Parse failed" };
    } finally {
      setParsing(false);
    }
  };

  /** Save a reviewed statement + transactions to the database. */
  const saveStatement = async (payload: {
    credit_card_id: string;
    statement_date: string;
    due_date: string;
    billing_period_start?: string | null;
    billing_period_end?: string | null;
    total_amount_due: number;
    minimum_amount_due: number;
    previous_balance?: number;
    payments_received?: number;
    new_charges?: number;
    interest_charged?: number;
    fees_charged?: number;
    credit_limit?: number | null;
    available_credit?: number | null;
    transactions: Array<{
      transaction_date: string;
      posting_date?: string | null;
      description: string;
      reference?: string | null;
      merchant_name?: string | null;
      amount: number;
      transaction_type: string;
      category?: string | null;
    }>;
    notes?: string | null;
  }): Promise<{ data: { statement_id: string; transactions_count: number } | null; error: string | null }> => {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { data: null, error: "Not authenticated" };

      const res = await fetch(`${API_BASE}/api/cc/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.detail || `Request failed (${res.status})` };
      }

      const json = await res.json();
      return { data: json.data, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Save failed" };
    } finally {
      setSaving(false);
    }
  };

  /** Fetch all statements for a credit card. */
  const fetchStatements = useCallback(async (creditCardId: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return [];

      const res = await fetch(
        `${API_BASE}/api/cc/statements?credit_card_id=${creditCardId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!res.ok) return [];
      const json = await res.json();
      const data = json.data as CCStatement[];
      setStatements(data);
      return data;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetch a single statement with all transactions. */
  const fetchStatementWithTransactions = async (
    statementId: string
  ): Promise<CCStatementWithTransactions | null> => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const res = await fetch(`${API_BASE}/api/cc/statements/${statementId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) return null;
      const json = await res.json();
      return json.data as CCStatementWithTransactions;
    } catch {
      return null;
    }
  };

  /** Record payment against a statement. */
  const payStatement = async (
    statementId: string,
    amount: number,
    paymentMethod: string = "bank_transfer",
    paidDate?: string,
    notes?: string
  ): Promise<{ data: Record<string, unknown> | null; error: string | null }> => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { data: null, error: "Not authenticated" };

      const res = await fetch(`${API_BASE}/api/cc/statements/${statementId}/pay`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paid_date: paidDate,
          payment_method: paymentMethod,
          notes,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.detail || `Payment failed (${res.status})` };
      }

      const json = await res.json();
      return { data: json.data, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Payment failed" };
    }
  };

  /** Approve selected transactions as expense entries. */
  const approveTransactions = async (
    statementId: string,
    transactionIds: string[],
    categories?: Record<string, string>
  ): Promise<{ data: { approved_count: number } | null; error: string | null }> => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { data: null, error: "Not authenticated" };

      const res = await fetch(
        `${API_BASE}/api/cc/statements/${statementId}/approve-transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction_ids: transactionIds,
            categories: categories || {},
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.detail || `Approval failed (${res.status})` };
      }

      const json = await res.json();
      return { data: json.data, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Approval failed" };
    }
  };

  return {
    parsing,
    saving,
    loading,
    statements,
    parseStatement,
    saveStatement,
    fetchStatements,
    fetchStatementWithTransactions,
    payStatement,
    approveTransactions,
  };
}
