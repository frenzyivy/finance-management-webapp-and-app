// ── Business module type aliases ──

export type BusinessIncomeCategory =
  | "client_project"
  | "retainer"
  | "freelance_platform"
  | "affiliate_commission"
  | "consultation"
  | "one_off_gig"
  | "refund"
  | "other";

export type BusinessExpenseCategory =
  | "saas_tools"
  | "marketing_ads"
  | "contractor_freelancer"
  | "hardware_equipment"
  | "learning_courses"
  | "travel_meetings"
  | "communication"
  | "domain_hosting"
  | "office_supplies"
  | "taxes_compliance"
  | "miscellaneous";

export type SubscriptionCategory =
  | "ai_tools"
  | "outreach"
  | "email_marketing"
  | "hosting"
  | "domain"
  | "design"
  | "analytics"
  | "crm"
  | "communication"
  | "development"
  | "storage"
  | "other";

export type BillingCycle = "monthly" | "quarterly" | "yearly";

export type FundedFrom = "personal_pocket" | "business_revenue" | "mixed";

export type LandedIn = "personal_account" | "business_direct" | "reinvested";

export type TransferDirection = "personal_to_business" | "business_to_personal";

export type ClientStatus = "active" | "prospect" | "churned" | "paused";

export type EngagementType = "project" | "retainer" | "hourly" | "pilot" | "one_off";

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "trial";

// ── Business table interfaces ──

export interface BusinessIncome {
  id: string;
  user_id: string;
  amount: number;
  category: BusinessIncomeCategory;
  source_name: string;
  project_name: string | null;
  client_id: string | null;
  invoice_number: string | null;
  date: string;
  payment_method: string | null;
  landed_in: LandedIn;
  notes: string | null;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessExpense {
  id: string;
  user_id: string;
  amount: number;
  category: BusinessExpenseCategory;
  sub_category: string | null;
  vendor_name: string;
  subscription_id: string | null;
  client_id: string | null;
  date: string;
  payment_method: string | null;
  funded_from: FundedFrom;
  personal_portion: number;
  is_tax_deductible: boolean;
  gst_applicable: boolean;
  gst_amount: number;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSubscription {
  id: string;
  user_id: string;
  name: string;
  category: SubscriptionCategory;
  vendor_url: string | null;
  cost_amount: number;
  cost_currency: string;
  billing_cycle: BillingCycle;
  monthly_equivalent: number;
  renewal_day: number;
  next_renewal_date: string;
  start_date: string;
  status: SubscriptionStatus;
  trial_ends_date: string | null;
  auto_renew: boolean;
  funded_from: FundedFrom;
  is_essential: boolean;
  notes: string | null;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
}

// Row shape from the `business_subscription_spend_mtd` view.
// Joins planned monthly cost with actual month-to-date expense spend per subscription.
export interface BusinessSubscriptionSpendMtd {
  id: string;
  user_id: string;
  name: string;
  monthly_equivalent: number;
  actual_spend_mtd: number;
  expense_count_mtd: number;
}

// Subscription enriched with MTD actual-spend figures for list/drill-down UI.
export type BusinessSubscriptionWithSpend = BusinessSubscription & {
  actual_spend_mtd: number;
  expense_count_mtd: number;
};

export interface BusinessClient {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  engagement_type: EngagementType | null;
  monthly_value: number | null;
  start_date: string | null;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalBusinessTransfer {
  id: string;
  user_id: string;
  direction: TransferDirection;
  amount: number;
  date: string;
  reason: string;
  personal_expense_id: string | null;
  personal_income_id: string | null;
  business_expense_id: string | null;
  business_income_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dashboard aggregate types ──

export interface BusinessDashboardMetrics {
  month: string;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  active_subscriptions: number;
  monthly_subscription_burn: number;
  personal_to_business: number;
  business_to_personal: number;
  net_transfer_flow: number;
  active_clients: number;
  revenue_vs_last_month: number;
  expense_vs_last_month: number;
}
