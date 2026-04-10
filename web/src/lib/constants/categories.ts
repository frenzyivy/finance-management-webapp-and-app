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
