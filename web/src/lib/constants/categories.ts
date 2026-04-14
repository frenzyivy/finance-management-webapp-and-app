export const INCOME_CATEGORIES = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance / Agency" },
  { value: "borrowed", label: "Borrowed Money" },
  { value: "side_income", label: "Side Income" },
  { value: "other", label: "Other" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "credit_card_payments", label: "Credit Card Payments" },
  { value: "emis", label: "EMIs" },
  { value: "rent", label: "Rent" },
  { value: "food_groceries", label: "Food & Groceries" },
  { value: "utilities", label: "Utilities" },
  { value: "transport", label: "Transport" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "family_personal", label: "Family & Personal" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "debt_repayment", label: "Debt Repayment" },
] as const;

export const FUNDING_SOURCES = [
  { value: "own_funds", label: "Own Funds" },
  { value: "debt_funded", label: "From a Debt" },
  { value: "debt_repayment", label: "EMI / Debt Payment" },
] as const;

export const BUSINESS_EXPENSE_CATEGORIES = [
  { value: "saas_tools", label: "SaaS / Tools" },
  { value: "marketing_ads", label: "Marketing & Ads" },
  { value: "contractor_freelancer", label: "Contractor / Freelancer" },
  { value: "hardware_equipment", label: "Hardware & Equipment" },
  { value: "learning_courses", label: "Learning & Courses" },
  { value: "travel_meetings", label: "Travel & Meetings" },
  { value: "communication", label: "Communication" },
  { value: "domain_hosting", label: "Domain & Hosting" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "taxes_compliance", label: "Taxes & Compliance" },
  { value: "miscellaneous", label: "Miscellaneous" },
] as const;

export const BUSINESS_INCOME_CATEGORIES = [
  { value: "client_project", label: "Client Project" },
  { value: "retainer", label: "Retainer" },
  { value: "freelance_platform", label: "Freelance Platform" },
  { value: "affiliate_commission", label: "Affiliate / Commission" },
  { value: "consultation", label: "Consultation" },
  { value: "one_off_gig", label: "One-off Gig" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
] as const;

export const INCOME_SOURCE_TYPES = [
  { value: "personal", label: "Personal (salary, family, side hustle)" },
  { value: "client", label: "Client / business work" },
  { value: "borrowed", label: "Borrowed from someone" },
] as const;

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
] as const;

export const DEBT_TYPES = [
  { value: "credit_card", label: "Credit Card Debt" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "bnpl", label: "Buy Now Pay Later" },
  { value: "borrowed_from_person", label: "Borrowed from Person" },
  { value: "other", label: "Other" },
] as const;

export const BNPL_PURCHASE_CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "appliances", label: "Appliances" },
  { value: "fashion", label: "Fashion" },
  { value: "furniture", label: "Furniture" },
  { value: "groceries", label: "Groceries" },
  { value: "health_personal", label: "Health & Personal" },
  { value: "books_education", label: "Books & Education" },
  { value: "home_kitchen", label: "Home & Kitchen" },
  { value: "travel", label: "Travel" },
  { value: "software", label: "Software" },
  { value: "other", label: "Other" },
] as const;

export const BNPL_PLATFORM_TYPES = [
  { value: "bnpl_app", label: "BNPL App" },
  { value: "credit_card_emi", label: "Credit Card EMI" },
  { value: "store_emi", label: "Store EMI" },
  { value: "finance_company", label: "Finance Company" },
] as const;

export const BNPL_TO_EXPENSE_CATEGORY: Record<string, string> = {
  electronics: "shopping",
  appliances: "shopping",
  fashion: "shopping",
  furniture: "shopping",
  groceries: "food_groceries",
  health_personal: "health",
  books_education: "education",
  home_kitchen: "shopping",
  travel: "transport",
  software: "subscriptions",
  other: "miscellaneous",
};
