"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BnplInvoiceFile, BnplInvoiceFileType } from "@/types/bnpl";

export interface ParsedInvoiceData {
  item_name: string | null;
  item_category: string | null;
  merchant_name: string | null;
  order_id: string | null;
  total_amount: number | null;
  down_payment: number | null;
  interest_rate: number | null;
  interest_rate_type: "per_annum" | "flat" | null;
  processing_fee: number | null;
  total_payable: number | null;
  emi_amount: number | null;
  total_emis: number | null;
  purchase_date: string | null;
  first_emi_date: string | null;
  emi_day_of_month: number | null;
  notes: string | null;
  confidence: Record<string, "high" | "low" | "missing">;
  warnings: string[];
}

const BNPL_BUCKET = "bnpl-invoices";
const RETENTION_DAYS = 120;
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useBnplParser() {
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * Send the invoice file(s) to the backend for Claude-based extraction.
   * Does NOT store the files — storage happens separately via uploadInvoiceFile.
   */
  const parseInvoice = async (
    orderFile: File,
    emiFile?: File | null
  ): Promise<{ data: ParsedInvoiceData | null; error: string | null }> => {
    setParsing(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        return { data: null, error: "Not authenticated" };
      }

      const formData = new FormData();
      formData.append("order_file", orderFile);
      if (emiFile) {
        formData.append("emi_file", emiFile);
      }

      const res = await fetch(`${API_BASE}/api/bnpl/parse-invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.detail || `Request failed (${res.status})` };
      }

      const json = await res.json();
      return { data: json.data as ParsedInvoiceData, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Parse failed";
      return { data: null, error: message };
    } finally {
      setParsing(false);
    }
  };

  /**
   * Upload a single invoice file to Supabase Storage.
   * Returns the file metadata to be saved on the purchase record.
   */
  const uploadInvoiceFile = async (
    file: File,
    purchaseId: string,
    type: BnplInvoiceFileType
  ): Promise<{ data: BnplInvoiceFile | null; error: string | null }> => {
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { data: null, error: "Not authenticated" };
      }

      // Generate unique filename
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${user.id}/${purchaseId}/${ts}-${type}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BNPL_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return { data: null, error: uploadError.message };
      }

      const now = new Date();
      const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const fileMeta: BnplInvoiceFile = {
        path: storagePath,
        name: file.name,
        type,
        size: file.size,
        uploaded_at: now.toISOString(),
        expires_at: expires.toISOString(),
      };

      return { data: fileMeta, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      return { data: null, error: message };
    } finally {
      setUploading(false);
    }
  };

  /**
   * Attach file metadata to a bnpl_purchases record (append to invoice_files array).
   */
  const attachInvoicesToPurchase = async (
    purchaseId: string,
    files: BnplInvoiceFile[]
  ): Promise<{ error: string | null }> => {
    const supabase = createClient();

    // Read existing invoice_files, append new ones
    const { data: existing, error: readError } = await supabase
      .from("bnpl_purchases")
      .select("invoice_files")
      .eq("id", purchaseId)
      .single();

    if (readError) {
      return { error: readError.message };
    }

    const current = (existing?.invoice_files as BnplInvoiceFile[]) || [];
    const merged = [...current, ...files];

    const { error: updateError } = await supabase
      .from("bnpl_purchases")
      .update({ invoice_files: merged })
      .eq("id", purchaseId);

    return { error: updateError?.message ?? null };
  };

  /**
   * Get a signed URL to view/download an invoice file.
   */
  const getInvoiceUrl = async (
    path: string
  ): Promise<{ url: string | null; error: string | null }> => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BNPL_BUCKET)
      .createSignedUrl(path, 60 * 10); // 10-minute URL

    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl, error: null };
  };

  /**
   * Delete a single invoice file (both storage and metadata).
   */
  const deleteInvoiceFile = async (
    purchaseId: string,
    path: string
  ): Promise<{ error: string | null }> => {
    const supabase = createClient();

    const { error: deleteError } = await supabase.storage
      .from(BNPL_BUCKET)
      .remove([path]);

    if (deleteError) return { error: deleteError.message };

    // Update metadata
    const { data: existing } = await supabase
      .from("bnpl_purchases")
      .select("invoice_files")
      .eq("id", purchaseId)
      .single();

    const current = (existing?.invoice_files as BnplInvoiceFile[]) || [];
    const filtered = current.filter((f) => f.path !== path);

    const { error: updateError } = await supabase
      .from("bnpl_purchases")
      .update({ invoice_files: filtered })
      .eq("id", purchaseId);

    return { error: updateError?.message ?? null };
  };

  return {
    parsing,
    uploading,
    parseInvoice,
    uploadInvoiceFile,
    attachInvoicesToPurchase,
    getInvoiceUrl,
    deleteInvoiceFile,
  };
}
