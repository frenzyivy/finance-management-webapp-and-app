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
  email: string;
  full_name: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  card_name: string;
  last_four_digits: string | null;
  billing_cycle_day: number;
  credit_limit: number | null;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  user_id: string;
  amount: number;
  category: IncomeCategory;
  source: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  payment_method: PaymentMethod | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntry {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequency | null;
  payment_method: PaymentMethod | null;
  credit_card_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: GoalStatus;
  priority: PriorityLevel;
  created_at: string;
  updated_at: string;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  principal_amount: number;
  current_balance: number;
  interest_rate: number | null;
  minimum_payment: number | null;
  due_date: string | null;
  status: DebtStatus;
  priority: PriorityLevel;
  lender: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface BudgetLimit {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  monthly_limit: number;
  month: string;
  created_at: string;
  updated_at: string;
}
