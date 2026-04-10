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
  | "miscellaneous";

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
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes: string | null;
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
