"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, Sparkles, AlertTriangle } from "lucide-react";

import { useBnplParser, type ParsedInvoiceData } from "@/hooks/use-bnpl-parser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { BnplPlatformType } from "@/types/bnpl";

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with parsed data + the uploaded files (to store post-submit). */
  onParsed: (data: ParsedInvoiceData, files: { orderFile: File; emiFile: File | null }) => void;
  /** Platform type — only shown for BNPL app types, hidden for credit_card_emi */
  platformType?: BnplPlatformType;
}

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/jpg,image/png";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function InvoiceUploadDialog({
  open,
  onOpenChange,
  onParsed,
  platformType = "bnpl_app",
}: InvoiceUploadDialogProps) {
  // Credit card EMI platforms should use the CC statement upload dialog instead
  if (platformType === "credit_card_emi") {
    return null;
  }

  const { parsing, parseInvoice } = useBnplParser();
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [emiFile, setEmiFile] = useState<File | null>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const emiInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOrderFile(null);
    setEmiFile(null);
    if (orderInputRef.current) orderInputRef.current.value = "";
    if (emiInputRef.current) emiInputRef.current.value = "";
  };

  const handleClose = () => {
    if (parsing) return;
    reset();
    onOpenChange(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE) return `${file.name} exceeds 10 MB limit`;
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) return `${file.name} is not PDF/JPG/PNG`;
    return null;
  };

  const handleOrderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setOrderFile(file);
  };

  const handleEmiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setEmiFile(file);
  };

  const handleParse = async () => {
    if (!orderFile) {
      toast.error("Please upload the order invoice first");
      return;
    }

    const { data, error } = await parseInvoice(orderFile, emiFile);

    if (error || !data) {
      toast.error(error || "Could not parse invoice");
      return;
    }

    if (data.warnings.length > 0) {
      toast.warning(`Parsed with ${data.warnings.length} warning(s)`, {
        description: data.warnings[0],
      });
    } else {
      toast.success("Invoice parsed successfully");
    }

    onParsed(data, { orderFile, emiFile });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            Upload Invoice to Auto-Fill
          </DialogTitle>
          <DialogDescription>
            Upload your Amazon Pay Later invoice and we&apos;ll extract the details automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Order Invoice — Required */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Order Invoice <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <FileDropzone
              file={orderFile}
              onClick={() => orderInputRef.current?.click()}
              onRemove={() => {
                setOrderFile(null);
                if (orderInputRef.current) orderInputRef.current.value = "";
              }}
              placeholder="Drop Amazon order PDF, or click to browse"
            />
            <input
              ref={orderInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleOrderFileChange}
              className="hidden"
            />
          </div>

          {/* EMI Confirmation — Optional */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">EMI Confirmation</label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <FileDropzone
              file={emiFile}
              onClick={() => emiInputRef.current?.click()}
              onRemove={() => {
                setEmiFile(null);
                if (emiInputRef.current) emiInputRef.current.value = "";
              }}
              placeholder="Screenshot of Pay Later dashboard (optional)"
            />
            <input
              ref={emiInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleEmiFileChange}
              className="hidden"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <AlertTriangle className="inline size-3 mr-1 text-amber-500" />
              Without EMI details, tenure and interest may be missing. You&apos;ll need to fill them in.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={parsing}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={!orderFile || parsing}>
              {parsing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Parse & Fill Form
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FileDropzoneProps {
  file: File | null;
  onClick: () => void;
  onRemove: () => void;
  placeholder: string;
}

function FileDropzone({ file, onClick, onRemove, placeholder }: FileDropzoneProps) {
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <FileText className="size-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 hover:bg-muted"
          aria-label="Remove file"
        >
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-4 py-6 text-center transition-colors hover:border-ring hover:bg-muted/30"
    >
      <Upload className="size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{placeholder}</p>
      <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG · Max 10 MB</p>
    </button>
  );
}
