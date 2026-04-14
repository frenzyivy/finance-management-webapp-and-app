"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ImportedTransaction,
  ImportStatus,
  LocalParsedTransaction,
  ParsedStatementResponse,
} from "@/types/database";
import { useSyncStore } from "@/lib/stores/sync-store";

const LOCAL_STAGING_KEY = "komalfin_pending_imports";

/** Read the local staging queue from localStorage */
function loadLocalStaging(): LocalParsedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STAGING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist the local staging queue to localStorage */
function saveLocalStaging(items: LocalParsedTransaction[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STAGING_KEY, JSON.stringify(items));
}

export function useImportedTransactions(statusFilter?: ImportStatus) {
  // Local staging queue (pending transactions — never touches cloud)
  const [localPending, setLocalPending] = useState<LocalParsedTransaction[]>([]);
  // Processed entries from Supabase (only approved/rejected items that already went to cloud)
  const [processedEntries, setProcessedEntries] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useSyncStore((s) => s.syncVersion);

  // Load local staging on mount
  useEffect(() => {
    setLocalPending(loadLocalStaging());
  }, []);

  // Persist local staging whenever it changes
  useEffect(() => {
    saveLocalStaging(localPending);
  }, [localPending]);

  // Fetch only processed entries from Supabase (imported/rejected/duplicate)
  const fetchProcessed = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("imported_transactions")
      .select("*")
      .in("status", ["imported", "rejected", "duplicate"])
      .order("parsed_date", { ascending: false });

    if (statusFilter && statusFilter !== "pending") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (!error && data) setProcessedEntries(data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchProcessed();
  }, [fetchProcessed, syncVersion]);

  // Combine for backward-compatible entries list
  const pendingAsImported: ImportedTransaction[] = localPending
    .filter((t) => !t.is_duplicate)
    .map((t) => ({
      id: t.local_id,
      user_id: "",
      import_source: t.import_source,
      raw_text: t.description,
      import_batch_id: t.import_batch_id,
      parsed_amount: t.amount,
      parsed_type: t.transaction_type,
      parsed_date: t.date,
      parsed_reference: t.reference,
      parsed_account_hint: null,
      parsed_description: t.description,
      assigned_category: null,
      assigned_payee_name: null,
      assigned_payment_method: null,
      status: "pending" as const,
      linked_expense_id: null,
      linked_income_id: null,
      dedup_hash: t.dedup_hash,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  const filter = statusFilter as string | undefined;
  const entries =
    filter === "pending"
      ? pendingAsImported
      : filter
      ? processedEntries
      : [...pendingAsImported, ...processedEntries];

  const pendingCount = localPending.filter((t) => !t.is_duplicate).length;

  // Upload statement — parsed locally, staged in browser
  const uploadStatement = async (file: File) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { error: "Not authenticated", data: null };

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/imports/upload-statement`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    if (res.ok) {
      const resp: ParsedStatementResponse = await res.json();

      // Convert to local staging items
      const newItems: LocalParsedTransaction[] = resp.transactions.map((t, i) => ({
        local_id: `${resp.batch_id}-${i}`,
        amount: t.amount,
        transaction_type: t.transaction_type,
        date: t.date,
        description: t.description,
        reference: t.reference,
        dedup_hash: t.dedup_hash,
        is_duplicate: t.is_duplicate,
        import_source: resp.source,
        import_batch_id: resp.batch_id,
      }));

      setLocalPending((prev) => [...newItems, ...prev]);

      return {
        data: {
          total: resp.total_count,
          pending: resp.total_count - resp.duplicate_count,
          duplicates: resp.duplicate_count,
        },
        error: null,
      };
    }

    // Extract error detail from response
    let errorMessage = `Failed to parse statement (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorMessage = typeof errJson.detail === "string"
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      const errText = await res.text().catch(() => "");
      if (errText) errorMessage += `: ${errText}`;
    }
    return { error: errorMessage, data: null };
  };

  // Approve — sends full transaction data to backend (privacy-first: no prior cloud storage)
  const approveEntries = async (
    items: {
      id: string;
      assigned_category: string;
      assigned_payee_name?: string;
      assigned_payment_method?: string;
    }[]
  ) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { error: "Not authenticated" };

    // Look up full transaction data from local staging
    const localMap = new Map(localPending.map((t) => [t.local_id, t]));
    const directItems = items
      .map((item) => {
        const local = localMap.get(item.id);
        if (!local) return null;
        return {
          amount: local.amount,
          transaction_type: local.transaction_type,
          date: local.date,
          description: local.description,
          reference: local.reference,
          dedup_hash: local.dedup_hash,
          assigned_category: item.assigned_category,
          assigned_payee_name: item.assigned_payee_name,
          assigned_payment_method: item.assigned_payment_method || "upi",
          import_source: local.import_source,
          import_batch_id: local.import_batch_id,
        };
      })
      .filter(Boolean);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/imports/approve-direct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ items: directItems }),
      }
    );

    if (res.ok) {
      const result = await res.json();
      // Remove approved items from local staging
      const approvedIds = new Set(items.map((i) => i.id));
      setLocalPending((prev) => prev.filter((t) => !approvedIds.has(t.local_id)));
      // Refresh processed list
      fetchProcessed();
      return { data: result };
    }
    return { error: "Failed to approve" };
  };

  // Reject — just remove from local staging (data never leaves the browser)
  const rejectEntries = async (ids: string[]) => {
    const idsSet = new Set(ids);
    setLocalPending((prev) => prev.filter((t) => !idsSet.has(t.local_id)));
    return { data: { rejected: ids, count: ids.length } };
  };

  // Clear all pending (local only)
  const clearPending = () => {
    setLocalPending([]);
  };

  // Summary stats (from local pending only)
  const totalDebits = localPending
    .filter((e) => e.transaction_type === "debit" && !e.is_duplicate)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredits = localPending
    .filter((e) => e.transaction_type === "credit" && !e.is_duplicate)
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    entries,
    loading,
    pendingCount,
    totalDebits,
    totalCredits,
    fetchEntries: fetchProcessed,
    updateEntry: async () => ({ error: null }),
    approveEntries,
    rejectEntries,
    uploadStatement,
    clearPending,
  };
}
