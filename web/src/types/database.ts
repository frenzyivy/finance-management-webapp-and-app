// ── Re-export BNPL types ──
export type {
  BnplPlatformType,
  BnplPlatformStatus,
  BnplPurchaseStatus,
  BnplPaymentStatus,
  BnplBillStatus,
  BnplInterestRateType,
  BnplInvoiceFileType,
  BnplInvoiceFile,
  BnplPurchaseCategory,
  BnplPlatform,
  BnplPlatformWithStats,
  BnplPurchase,
  BnplPayment,
  BnplBill,
  BnplBillPaymentItem,
  BnplBillWithPayments,
  BnplPurchaseWithPayments,
  BnplPlatformWithPurchases,
  BnplUpcomingEMI,
} from "./bnpl";

// ── Category type aliases ──

export type IncomeCategory =
  | "salary"
  | "freelance"
  | "borrowed"
  | "side_income"
  | "other";

export type ExpenseCategory =
  | "credit_card_payments"
  | "emis"
  | "rent"
  | "food_groceries"
  | "utilities"
  | "transport"
  | "shopping"
  | "health"
  | "education"
  | "entertainment"
  | "subscriptions"
  | "family_personal"
  | "miscellaneous"
  | "debt_repayment";

export type FundingSource = "own_funds" | "debt_funded" | "debt_repayment" | "mixed";
export type AllocationType = "debt_usage" | "debt_repayment";

export type PaymentMethod =
  | "bank_transfer"
  | "upi"
  | "credit_card"
  | "debit_card"
  | "cash"
  | "wallet";

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type DebtType =
  | "credit_card"
  | "personal_loan"
  | "bnpl"
  | "borrowed_from_person"
  | "other";

export type DebtStatus = "active" | "paid_off";

export type GoalPriority = "high" | "medium" | "low";

export type GoalStatus = "active" | "completed" | "paused";

// ── Database table interfaces ──

export interface Profile {
  id: string;
  name: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  card_name: string;
  last_four_digits: string;
  billing_cycle_day: number;
  credit_limit: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  user_id: string;
  amount: number;
  category: IncomeCategory;
  source_name: string;
  date: string;
  payment_method: PaymentMethod;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  linked_debt_id: string | null;
  notes: string | null;
  is_auto_generated: boolean;
  source_recurring_id: string | null;
  last_recurrence_date: string | null;
  is_business_withdrawal: boolean;
  linked_transfer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntry {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  sub_category: string | null;
  payee_name: string;
  date: string;
  payment_method: PaymentMethod;
  credit_card_id: string | null;
  is_emi: boolean;
  linked_debt_id: string | null;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  receipt_url: string | null;
  notes: string | null;
  funding_source: FundingSource;
  is_auto_generated: boolean;
  source_debt_payment_id: string | null;
  source_recurring_id: string | null;
  last_recurrence_date: string | null;
  is_business_investment: boolean;
  linked_transfer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_balance: number;
  priority: GoalPriority;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  source_description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  creditor_name: string;
  original_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  emi_amount: number | null;
  emi_day_of_month: number | null;
  total_emis: number | null;
  remaining_emis: number | null;
  start_date: string;
  expected_payoff_date: string | null;
  status: DebtStatus;
  allocated_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtAllocation {
  id: string;
  debt_id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes: string | null;
  linked_expense_id: string | null;
  is_auto_generated: boolean;
  source_expense_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetLimit {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}

// ── Import types ──

export type ImportSource = "sms" | "bank_statement_csv" | "bank_statement_pdf";
export type TransactionType = "debit" | "credit";
export type ImportStatus = "pending" | "imported" | "rejected" | "duplicate";

export interface ImportedTransaction {
  id: string;
  user_id: string;
  import_source: ImportSource;
  raw_text: string | null;
  import_batch_id: string | null;
  parsed_amount: number;
  parsed_type: TransactionType;
  parsed_date: string;
  parsed_reference: string | null;
  parsed_account_hint: string | null;
  parsed_description: string | null;
  assigned_category: string | null;
  assigned_payee_name: string | null;
  assigned_payment_method: string | null;
  status: ImportStatus;
  linked_expense_id: string | null;
  linked_income_id: string | null;
  dedup_hash: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Privacy-first local staging types ──

/** A parsed transaction that lives only in the browser — never stored in cloud */
export interface LocalParsedTransaction {
  local_id: string;
  amount: number;
  transaction_type: TransactionType;
  date: string;
  description: string | null;
  reference: string | null;
  dedup_hash: string | null;
  is_duplicate: boolean;
  import_source: ImportSource;
  import_batch_id: string;
}

/** Response from the upload-statement endpoint (no DB rows created) */
export interface ParsedStatementResponse {
  batch_id: string;
  source: ImportSource;
  transactions: {
    amount: number;
    transaction_type: TransactionType;
    date: string;
    description: string | null;
    reference: string | null;
    dedup_hash: string | null;
    is_duplicate: boolean;
  }[];
  total_count: number;
  duplicate_count: number;
}
