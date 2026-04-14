import type { BnplPlatformType } from "@/types/bnpl";

export interface BnplPlatformTemplate {
  name: string;
  platform_type: BnplPlatformType;
  color: string;
  /** Whether this platform supports invoice scanning (BNPL apps) */
  supports_invoice_scan?: boolean;
  /** Whether this platform supports statement PDF upload (credit cards) */
  supports_statement_upload?: boolean;
}

export const BNPL_PLATFORM_TEMPLATES: BnplPlatformTemplate[] = [
  // BNPL apps
  { name: "Amazon Pay Later", platform_type: "bnpl_app", color: "#FF9900", supports_invoice_scan: true },
  { name: "Flipkart Pay Later", platform_type: "bnpl_app", color: "#2874F0", supports_invoice_scan: true },
  { name: "Simpl", platform_type: "bnpl_app", color: "#00B894", supports_invoice_scan: true },
  { name: "LazyPay", platform_type: "bnpl_app", color: "#6C5CE7", supports_invoice_scan: true },
  // Credit card EMIs
  { name: "HDFC Credit Card", platform_type: "credit_card_emi", color: "#004B87", supports_statement_upload: true },
  { name: "SBI Credit Card", platform_type: "credit_card_emi", color: "#22409A", supports_statement_upload: true },
  { name: "ICICI Credit Card", platform_type: "credit_card_emi", color: "#F58220", supports_statement_upload: true },
  { name: "Axis Credit Card", platform_type: "credit_card_emi", color: "#97144D", supports_statement_upload: true },
  // Store EMIs
  { name: "Croma EMI", platform_type: "store_emi", color: "#00A651" },
  { name: "Reliance Digital EMI", platform_type: "store_emi", color: "#0055A4" },
  // Finance companies
  { name: "Bajaj Finance EMI", platform_type: "finance_company", color: "#004C8F" },
  { name: "HDFC Personal Loan EMI", platform_type: "finance_company", color: "#004B87" },
];
