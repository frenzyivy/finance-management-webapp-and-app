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

export type DebtType =
  | "credit_card"
  | "personal_loan"
  | "bnpl"
  | "borrowed_from_person"
  | "other";

export type PriorityLevel = "high" | "medium" | "low";

export type GoalStatus = "active" | "completed" | "paused";

export type DebtStatus = "active" | "paid_off";

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type PaymentMethod =
  | "bank_transfer"
  | "upi"
  | "credit_card"
  | "debit_card"
  | "cash"
  | "wallet";

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
  billing_cycle_day: number | null;
  credit_limit: number | null;
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
  payment_method: string;
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
  payment_method: string;
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
  source_bnpl_purchase_id: string | null;
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
  priority: PriorityLevel;
  target_date: string | null;
  color: string;
  icon: string;
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
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  creditor_name: string;
  original_amount: number;
  outstanding_balance: number;
  interest_rate: number | null;
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
}

export interface BudgetLimit {
  id: string;
  user_id: string;
  category: string;
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

/** A parsed transaction that lives only on device — never stored in cloud */
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

/** Response from upload-statement (no DB rows created) */
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

// ── Credit Card Statement types ──

export type CCStatementStatus =
  | "upcoming"
  | "due"
  | "paid"
  | "partially_paid"
  | "overdue";

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
  total_amount_due: number;
  minimum_amount_due: number;
  interest_charged: number;
  fees_charged: number;
  amount_paid: number;
  status: CCStatementStatus;
  created_at: string;
}

export interface CCStatementTransaction {
  id: string;
  statement_id: string;
  transaction_date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  transaction_type: CCTransactionType;
  category: string | null;
  is_approved: boolean;
}
