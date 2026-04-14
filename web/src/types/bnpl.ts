// ── BNPL / EMI Purchase Tracker types ──

export type BnplPlatformType =
  | "bnpl_app"
  | "credit_card_emi"
  | "store_emi"
  | "finance_company";

export type BnplPlatformStatus = "active" | "inactive";

export type BnplPurchaseStatus = "active" | "paid_off" | "overdue" | "foreclosed";

export type BnplInvoiceFileType = "order_invoice" | "emi_confirmation";

export interface BnplInvoiceFile {
  path: string;
  name: string;
  type: BnplInvoiceFileType;
  size: number;
  uploaded_at: string;
  expires_at: string;
}

export type BnplPaymentStatus =
  | "upcoming"
  | "due"
  | "paid"
  | "late_paid"
  | "overdue"
  | "skipped";

export type BnplInterestRateType = "per_annum" | "flat";

export type BnplPurchaseCategory =
  | "electronics"
  | "appliances"
  | "fashion"
  | "furniture"
  | "groceries"
  | "health_personal"
  | "books_education"
  | "home_kitchen"
  | "travel"
  | "software"
  | "other";

export type BnplBillStatus =
  | "upcoming"
  | "due"
  | "partially_paid"
  | "paid"
  | "overdue";

export interface BnplPlatform {
  id: string;
  user_id: string;
  name: string;
  platform_type: BnplPlatformType;
  credit_limit: number | null;
  billing_day: number | null;
  color: string;
  status: BnplPlatformStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BnplPlatformWithStats extends BnplPlatform {
  current_outstanding: number;
  active_purchases_count: number;
  monthly_emi_total: number;
}

export interface BnplPurchase {
  id: string;
  user_id: string;
  platform_id: string;
  item_name: string;
  item_category: BnplPurchaseCategory;
  order_id: string | null;
  merchant_name: string | null;
  total_amount: number;
  down_payment: number;
  financed_amount: number; // GENERATED column
  interest_rate: number;
  interest_rate_type: BnplInterestRateType;
  processing_fee: number;
  total_payable: number;
  emi_amount: number;
  total_emis: number;
  paid_emis: number;
  remaining_emis: number; // GENERATED column
  outstanding_balance: number;
  purchase_date: string;
  first_emi_date: string;
  last_emi_date: string | null;
  emi_day_of_month: number;
  status: BnplPurchaseStatus;
  linked_expense_id: string | null;
  is_business_purchase: boolean;
  invoice_files: BnplInvoiceFile[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BnplPayment {
  id: string;
  user_id: string;
  purchase_id: string;
  bill_id: string | null;
  emi_number: number;
  amount: number;
  principal_portion: number | null;
  interest_portion: number | null;
  due_date: string;
  paid_date: string | null;
  status: BnplPaymentStatus;
  payment_method: string | null;
  linked_expense_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BnplBill {
  id: string;
  user_id: string;
  platform_id: string;
  bill_month: number;
  bill_year: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: BnplBillStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BnplBillPaymentItem {
  payment_id: string;
  purchase_id: string;
  item_name: string;
  emi_number: number;
  total_emis: number;
  amount: number;
  status: BnplPaymentStatus;
  paid_date: string | null;
}

export interface BnplBillWithPayments extends BnplBill {
  payments: BnplBillPaymentItem[];
}

// Composite types for UI rendering

export interface BnplPurchaseWithPayments extends BnplPurchase {
  payments: BnplPayment[];
}

export interface BnplPlatformWithPurchases extends BnplPlatformWithStats {
  purchases: BnplPurchase[];
}

export interface BnplUpcomingEMI {
  payment_id: string;
  purchase_id: string;
  platform_name: string;
  platform_color: string;
  item_name: string;
  emi_number: number;
  total_emis: number;
  amount: number;
  due_date: string;
  status: BnplPaymentStatus;
}
