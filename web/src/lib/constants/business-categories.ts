// ── Business Income Categories ──

export const BUSINESS_INCOME_CATEGORIES = [
  { value: "client_project", label: "Client Project" },
  { value: "retainer", label: "Monthly Retainer" },
  { value: "freelance_platform", label: "Freelance Platform" },
  { value: "affiliate_commission", label: "Affiliate Commission" },
  { value: "consultation", label: "Consultation Fee" },
  { value: "one_off_gig", label: "One-off Gig" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
] as const;

// ── Business Expense Categories (with subcategories) ──

export const BUSINESS_EXPENSE_CATEGORIES = [
  { value: "saas_tools", label: "SaaS Tools & Subscriptions" },
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

export const BUSINESS_EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  saas_tools: ["AI Tools", "Outreach Tools", "Email Marketing", "CRM", "Analytics", "Design", "Development", "Other SaaS"],
  marketing_ads: ["Meta Ads", "Google Ads", "LinkedIn Ads", "Content Creation", "Influencer", "Other Marketing"],
  contractor_freelancer: ["Developer", "Designer", "Content Writer", "VA", "Consultant", "Other Contractor"],
  hardware_equipment: ["Laptop/PC", "Phone", "Camera/Audio", "Peripherals", "Furniture", "Other Hardware"],
  learning_courses: ["Online Course", "Book", "Workshop", "Certification", "Conference", "Other Learning"],
  travel_meetings: ["Client Meeting", "Conference Travel", "Local Transport", "Accommodation", "Food (Business)", "Other Travel"],
  communication: ["Phone Plan (Business %)", "Internet (Business %)", "Zoom/Meet", "Other Communication"],
  domain_hosting: ["Domain Registration", "VPS/Server", "CDN", "SSL", "DNS", "Other Hosting"],
  office_supplies: ["Stationery", "Printing", "Other Supplies"],
  taxes_compliance: ["GST Payment", "CA Fees", "Legal", "Registration", "Other Compliance"],
  miscellaneous: ["Charity/Sponsorship", "Gift (Client)", "Bank Charges", "Other"],
};

// ── Subscription Categories ──

export const SUBSCRIPTION_CATEGORIES = [
  { value: "ai_tools", label: "AI Tools" },
  { value: "outreach", label: "Outreach" },
  { value: "email_marketing", label: "Email Marketing" },
  { value: "hosting", label: "Hosting" },
  { value: "domain", label: "Domain" },
  { value: "design", label: "Design" },
  { value: "analytics", label: "Analytics" },
  { value: "crm", label: "CRM" },
  { value: "communication", label: "Communication" },
  { value: "development", label: "Development" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" },
] as const;

// ── Billing Cycles ──

export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

// ── Funded From (Business Expenses + Subscriptions) ──

export const FUNDED_FROM_OPTIONS = [
  { value: "personal_pocket", label: "My Personal Pocket" },
  { value: "business_revenue", label: "Business Revenue" },
  { value: "mixed", label: "Mixed (Personal + Business)" },
] as const;

// ── Landed In (Business Income) ──

export const LANDED_IN_OPTIONS = [
  { value: "personal_account", label: "My Personal Account" },
  { value: "business_direct", label: "Directly Reinvested" },
  { value: "reinvested", label: "Paid a Business Expense" },
] as const;

// ── Client Statuses ──

export const CLIENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "churned", label: "Churned" },
  { value: "paused", label: "Paused" },
] as const;

// ── Engagement Types ──

export const ENGAGEMENT_TYPES = [
  { value: "project", label: "Project-based" },
  { value: "retainer", label: "Retainer" },
  { value: "hourly", label: "Hourly" },
  { value: "pilot", label: "Pilot" },
  { value: "one_off", label: "One-off" },
] as const;

// ── Subscription Statuses ──

export const SUBSCRIPTION_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "trial", label: "Trial" },
] as const;
