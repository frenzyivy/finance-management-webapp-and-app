// ── Credit Card Statement types ──

export type CCStatementStatus =
  | "upcoming"
  | "due"
  | "paid"
  | "partially_paid"
  | "overdue";

export type CCPaymentType = "full" | "minimum" | "partial" | "unpaid";

export type CCTransactionType =
  | "purchase"
  | "refund"
  | "fee"
  | "interest"
  | "payment"
  | "cashback"
  | "emi_charge";

export interface CCStatement {
  id: string;
  user_id: string;
  credit_card_id: string;
  statement_date: string;
  due_date: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  total_amount_due: number;
  minimum_amount_due: number;
  previous_balance: number;
  payments_received: number;
  new_charges: number;
  interest_charged: number;
  fees_charged: number;
  credit_limit: number | null;
  available_credit: number | null;
  amount_paid: number;
  paid_date: string | null;
  payment_type: CCPaymentType | null;
  status: CCStatementStatus;
  statement_file_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CCStatementTransaction {
  id: string;
  user_id: string;
  statement_id: string;
  transaction_date: string;
  posting_date: string | null;
  description: string;
  reference: string | null;
  merchant_name: string | null;
  amount: number;
  transaction_type: CCTransactionType;
  category: string | null;
  linked_expense_id: string | null;
  is_approved: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CCStatementWithTransactions extends CCStatement {
  transactions: CCStatementTransaction[];
}

// Parsed data from the parser API (before saving)
export interface ParsedCCTransactionData {
  transaction_date: string | null;
  posting_date: string | null;
  description: string | null;
  reference: string | null;
  merchant_name: string | null;
  amount: number | null;
  transaction_type: CCTransactionType;
  category: string | null;
}

export interface ParsedCCStatementData {
  card_last_four: string | null;
  statement_date: string | null;
  due_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  total_amount_due: number | null;
  minimum_amount_due: number | null;
  previous_balance: number | null;
  payments_received: number | null;
  new_charges: number | null;
  interest_charged: number | null;
  fees_charged: number | null;
  credit_limit: number | null;
  available_credit: number | null;
  transactions: ParsedCCTransactionData[];
  confidence: Record<string, "high" | "low" | "missing">;
  warnings: string[];
}
