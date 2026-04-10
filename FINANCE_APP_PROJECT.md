# 💰 KomalFin — Personal Finance Management Application

## Project Overview

**App Name:** KomalFin (working title — rename anytime)
**Owner:** Komal
**Purpose:** A unified personal finance management platform to track all income, expenses, debts, savings goals, and investments — with monthly analytics to understand spending patterns and build financial health over time.

**Platforms:**
- Web App (primary)
- Mobile App (Android + iOS)
- Real-time sync between web and mobile

---

## Core Modules

The application is divided into **6 core modules**, each handling a distinct financial domain.

---

### Module 1: Income Tracker (Money In)

Track every rupee coming in, categorized by source.

**Income Categories:**
| Category | Description | Example |
|----------|-------------|---------|
| Salary | Monthly salary from employment | ₹XX,XXX from [Employer] |
| Freelance / Agency | Income from Alainza Bizz or freelance gigs | Client payments, project fees |
| Borrowed Money | Money borrowed from friends, family, or others | ₹5,000 from [Friend Name] |
| Side Income | YouTube, affiliate, ad revenue, etc. | YouTube earnings, referral bonuses |
| Other | Any miscellaneous income | Gifts, cashback, refunds |

**Data Fields per Income Entry:**
- Amount (₹)
- Source category (from above)
- Source name (person/company/platform)
- Date received
- Payment method (bank transfer, UPI, cash, etc.)
- Notes (optional)
- Recurring? (Yes/No — if yes, frequency: monthly/weekly)

**Key Features:**
- Add one-time or recurring income entries
- If "Borrowed Money" — auto-link to Debt Tracker (Module 4) as a liability
- Monthly income summary with breakdown by category
- Income trend chart (month-over-month)

---

### Module 2: Expense Tracker (Money Out)

Track every rupee going out, with granular categorization.

**Expense Categories:**
| Category | Sub-categories | Examples |
|----------|---------------|----------|
| Credit Card Payments | EMI, minimum due, full payment | HDFC CC, SBI CC |
| EMIs | Loan EMIs, Buy-Now-Pay-Later EMIs | Personal loan, Amazon Pay Later, Flipkart Pay Later |
| Rent | House rent, office rent | Monthly rent |
| Food & Groceries | Dining out, groceries, Swiggy/Zomato | Daily food expenses |
| Utilities | Electricity, water, internet, phone | Monthly bills |
| Transport | Fuel, Uber/Ola, metro, maintenance | Daily commute |
| Shopping | Clothes, electronics, personal items | Amazon, Flipkart purchases |
| Health | Medical, pharmacy, insurance premiums | Doctor visits, medicines |
| Education | Courses, books, GRE prep, subscriptions | GRE materials, Udemy |
| Entertainment | Movies, subscriptions (Netflix, Spotify) | OTT platforms |
| Subscriptions | SaaS tools, services, memberships | Claude Max, Instantly.ai, domains |
| Family & Personal | Gifts, family support, personal care | Household contributions |
| Miscellaneous | Anything that doesn't fit above | One-off expenses |

**Data Fields per Expense Entry:**
- Amount (₹)
- Category + sub-category
- Payee / merchant name
- Date of expense
- Payment method (credit card [which one], debit card, UPI, cash, wallet)
- Is this an EMI? (Yes/No — if yes, link to Debt Tracker)
- Recurring? (Yes/No — frequency)
- Notes (optional)
- Receipt/attachment (optional — photo upload on mobile)

**Key Features:**
- Quick-add expense (minimal fields for fast logging)
- Recurring expense auto-entries (rent, subscriptions, EMIs)
- Category-wise monthly spending breakdown
- Spending alerts (e.g., "You've spent ₹X on food this month, 20% more than last month")
- Credit card spend tracking per card

---

### Module 3: Piggy Bank — Savings Goals

A visual, motivating savings tracker with named goals.

**Savings Goals:**

| Goal Name | Target Amount (₹) | Priority | Deadline (optional) |
|-----------|-------------------|----------|---------------------|
| Emergency Fund | User-defined | High | Ongoing |
| Travel Fund | User-defined | Medium | User-defined |
| Study Fund (GRE + College) | User-defined | High | User-defined |
| Custom Goal | User-defined | User-defined | User-defined |

**Data Fields per Goal:**
- Goal name
- Target amount (₹)
- Current balance (₹) — starts at ₹0
- Priority (High / Medium / Low)
- Target date (optional)
- Color/icon (for visual identity)
- Notes

**Data Fields per Contribution:**
- Amount deposited (₹)
- Date
- Source (from which income or manual transfer)
- Notes

**Key Features:**
- Visual progress bar per goal (e.g., "Emergency Fund: ₹15,000 / ₹1,00,000 — 15%")
- Piggy bank animation when adding money (fun micro-interaction)
- Monthly auto-contribute option (set ₹X to auto-allocate to a goal each month)
- Milestone celebrations (25%, 50%, 75%, 100% reached)
- Goal projection: "At your current rate, you'll reach this goal by [Month Year]"
- Dashboard widget showing all goals at a glance

---

### Module 4: Debt Tracker (What I Owe)

Track all debts, EMIs, and borrowed money in one place.

**Debt Types:**
| Type | Examples |
|------|----------|
| Credit Card Debt | Outstanding balances on credit cards |
| Personal Loans | Bank loans, fintech loans |
| Buy-Now-Pay-Later | Amazon Pay Later, Flipkart Pay Later, Simpl |
| Borrowed from People | Money borrowed from friends/family |
| Other | Any other liabilities |

**Data Fields per Debt:**
- Debt name / label
- Type (from above)
- Creditor name (bank, friend, platform)
- Original amount borrowed (₹)
- Outstanding balance (₹)
- Interest rate (% — if applicable)
- EMI amount (₹ per month)
- EMI date (which day of month)
- Total EMIs / Remaining EMIs
- Start date
- Expected payoff date
- Status (Active / Paid Off)
- Notes

**Key Features:**
- Total debt overview dashboard ("You owe ₹X across Y debts")
- EMI calendar — shows all EMI due dates on a calendar view
- Payment logging — record each payment made, auto-updates balance
- Debt payoff progress per debt (visual bar)
- Payoff projection: "At current EMI, this debt clears by [Date]"
- Smart alerts: "EMI for Amazon Pay Later due in 3 days"
- Snowball vs Avalanche strategy suggestion (future enhancement)
- When someone repays borrowed money → auto-link to Income Tracker

---

### Module 5: Monthly Analytics & Insights

The brain of the app — understand where your money goes.

**Dashboard Components:**

1. **Monthly Summary Card**
   - Total Income this month
   - Total Expenses this month
   - Total Savings this month
   - Net Cash Flow (Income − Expenses − Savings Contributions)

2. **Expense Breakdown Chart**
   - Pie/donut chart: category-wise spending
   - Bar chart: daily spending pattern
   - Top 5 spending categories ranked

3. **Income vs Expense Trend**
   - Line chart: 6-month rolling comparison
   - Highlights months where expenses > income (red flag)

4. **Savings Progress**
   - Combined progress across all piggy bank goals
   - Monthly savings rate percentage

5. **Debt Health**
   - Total debt remaining
   - Monthly debt payments total
   - Debt-to-income ratio
   - Months to debt-free (projection)

6. **Smart Insights (AI-powered — future)**
   - "You spent 30% more on food this month compared to your 3-month average"
   - "Your emergency fund will be fully funded in 8 months at current pace"
   - "Consider paying off [High Interest Debt] first — saves ₹X in interest"

**Reporting:**
- Monthly report auto-generated (downloadable as PDF)
- Year-in-review annual summary
- Custom date range filtering

---

### Module 6: Settings & Configuration

**User Settings:**
- Currency (default ₹ INR, but allow multi-currency for future)
- Monthly budget limits per category
- Notification preferences (EMI reminders, spending alerts, goal milestones)
- Dark mode / Light mode
- Export data (CSV, PDF)
- Backup & restore

**Account Management:**
- Linked credit cards (just names + last 4 digits for identification, no actual card data stored)
- Linked bank accounts (labels only — for categorizing transactions)
- Manage recurring entries

---

## Technical Architecture

### Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend (Web)** | Next.js 14+ (App Router) | SSR, great DX, your existing expertise |
| **Frontend (Mobile)** | React Native / Expo | Code sharing with React, cross-platform |
| **Backend** | FastAPI (Python) | Your existing stack, great for APIs |
| **Database** | Supabase (PostgreSQL) | Real-time sync, auth, your go-to DB |
| **Auth** | Supabase Auth | Email/password + Google OAuth |
| **Real-time Sync** | Supabase Realtime | Web ↔ Mobile instant sync |
| **File Storage** | Supabase Storage | Receipt uploads, report PDFs |
| **Charts** | Recharts (web) / Victory (mobile) | React-native compatible charting |
| **Notifications** | Supabase Edge Functions + FCM | Push notifications for EMI reminders |
| **Hosting** | Vercel (web) + Your VPS (API) | Your existing infrastructure |

### Database Schema (High-Level)

```
users
├── id (uuid, PK)
├── email
├── name
├── currency (default: INR)
├── created_at
└── updated_at

income_entries
├── id (uuid, PK)
├── user_id (FK → users)
├── amount (decimal)
├── category (enum: salary, freelance, borrowed, side_income, other)
├── source_name (text)
├── date (date)
├── payment_method (text)
├── is_recurring (boolean)
├── recurrence_frequency (enum: weekly, monthly, quarterly, yearly)
├── linked_debt_id (FK → debts, nullable — for borrowed money)
├── notes (text, nullable)
├── created_at
└── updated_at

expense_entries
├── id (uuid, PK)
├── user_id (FK → users)
├── amount (decimal)
├── category (enum)
├── sub_category (text, nullable)
├── payee_name (text)
├── date (date)
├── payment_method (text)
├── credit_card_id (FK → credit_cards, nullable)
├── is_emi (boolean)
├── linked_debt_id (FK → debts, nullable)
├── is_recurring (boolean)
├── recurrence_frequency (enum)
├── receipt_url (text, nullable)
├── notes (text, nullable)
├── created_at
└── updated_at

savings_goals
├── id (uuid, PK)
├── user_id (FK → users)
├── name (text)
├── target_amount (decimal)
├── current_balance (decimal, default: 0)
├── priority (enum: high, medium, low)
├── target_date (date, nullable)
├── color (text)
├── icon (text)
├── status (enum: active, completed, paused)
├── created_at
└── updated_at

savings_contributions
├── id (uuid, PK)
├── goal_id (FK → savings_goals)
├── user_id (FK → users)
├── amount (decimal)
├── date (date)
├── source_description (text, nullable)
├── notes (text, nullable)
├── created_at
└── updated_at

debts
├── id (uuid, PK)
├── user_id (FK → users)
├── name (text)
├── type (enum: credit_card, personal_loan, bnpl, borrowed_from_person, other)
├── creditor_name (text)
├── original_amount (decimal)
├── outstanding_balance (decimal)
├── interest_rate (decimal, nullable)
├── emi_amount (decimal, nullable)
├── emi_day_of_month (integer, nullable)
├── total_emis (integer, nullable)
├── remaining_emis (integer, nullable)
├── start_date (date)
├── expected_payoff_date (date, nullable)
├── status (enum: active, paid_off)
├── notes (text, nullable)
├── created_at
└── updated_at

debt_payments
├── id (uuid, PK)
├── debt_id (FK → debts)
├── user_id (FK → users)
├── amount (decimal)
├── date (date)
├── notes (text, nullable)
├── created_at
└── updated_at

credit_cards
├── id (uuid, PK)
├── user_id (FK → users)
├── card_name (text)
├── last_four_digits (text)
├── billing_cycle_day (integer)
├── credit_limit (decimal, nullable)
├── created_at
└── updated_at

budget_limits
├── id (uuid, PK)
├── user_id (FK → users)
├── category (text)
├── monthly_limit (decimal)
├── created_at
└── updated_at
```

### Supabase Row-Level Security (RLS)

All tables enforce RLS so each user can only access their own data:
```sql
-- Example policy (applied to every table)
CREATE POLICY "Users can only access own data"
ON [table_name]
FOR ALL
USING (auth.uid() = user_id);
```

---

## Development Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Set up Next.js project with Supabase integration
- [ ] Supabase Auth (email + Google)
- [ ] Database schema creation + RLS policies
- [ ] Basic layout: sidebar navigation, responsive shell
- [ ] Income Tracker — full CRUD
- [ ] Expense Tracker — full CRUD

### Phase 2 — Goals & Debt (Week 3–4)
- [ ] Piggy Bank / Savings Goals — full CRUD + progress bars
- [ ] Debt Tracker — full CRUD + payment logging
- [ ] EMI calendar view
- [ ] Recurring entry automation (cron via Supabase Edge Functions)

### Phase 3 — Analytics Dashboard (Week 5–6)
- [ ] Monthly summary cards
- [ ] Expense breakdown charts (pie, bar)
- [ ] Income vs expense trend line chart
- [ ] Savings progress overview
- [ ] Debt health metrics
- [ ] PDF monthly report generation

### Phase 4 — Mobile App (Week 7–10)
- [ ] React Native / Expo project setup
- [ ] Shared API layer with web
- [ ] Core screens: Dashboard, Add Income, Add Expense, Goals, Debts
- [ ] Real-time sync via Supabase Realtime
- [ ] Push notifications for EMI reminders
- [ ] Receipt photo capture

### Phase 5 — Polish & Enhancements (Ongoing)
- [ ] Smart insights (AI-powered spending analysis)
- [ ] Budget limit alerts
- [ ] Year-in-review report
- [ ] Multi-currency support
- [ ] Data export (CSV, PDF)
- [ ] Widget for mobile home screen

---

## UI/UX Direction

**Design Aesthetic:** Clean, modern, slightly playful (piggy bank animations, celebration confetti on goal milestones) but professional enough for serious financial tracking.

**Color Palette Concept:**
- Primary: Deep teal/emerald (trust, money, growth)
- Accent: Warm amber/gold (wealth, goals)
- Success: Green tones
- Danger/Debt: Soft coral/red
- Background: Off-white (light) / Deep charcoal (dark)

**Key UX Principles:**
- Quick-add everything (2 taps to log an expense on mobile)
- Visual-first dashboards (charts over tables)
- Motivational micro-interactions (piggy bank fills up, confetti on milestones)
- Zero financial jargon — plain language everywhere
- Mobile-first responsive design

---

## File & Folder Structure (Web App)

```
komalfin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login, signup pages
│   │   ├── (dashboard)/        # Protected routes
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── income/         # Income tracker
│   │   │   ├── expenses/       # Expense tracker
│   │   │   ├── goals/          # Piggy bank / savings goals
│   │   │   ├── debts/          # Debt tracker
│   │   │   ├── analytics/      # Monthly analytics
│   │   │   └── settings/       # Settings
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── charts/             # Chart components
│   │   ├── forms/              # Form components
│   │   └── layout/             # Sidebar, header, etc.
│   ├── lib/
│   │   ├── supabase/           # Supabase client + helpers
│   │   ├── utils/              # Utility functions
│   │   └── constants/          # Categories, enums
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript types
│   └── stores/                 # State management (Zustand)
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── seed.sql                # Seed data
├── public/
├── CLAUDE.md                   # Claude Code instructions
├── package.json
└── next.config.js
```

---

## Notes & Future Ideas

- **Voice input:** "Hey KomalFin, I spent 500 on lunch today" (speech-to-expense)
- **WhatsApp/Telegram bot:** Log expenses via chat
- **Bank SMS parsing:** Auto-detect transactions from bank SMS (Android)
- **Shared expenses:** Split bills with friends
- **Investment tracker:** Mutual funds, SIPs, stocks (Phase 6+)
- **YouTube content:** Build-in-public series on this app

---

*This document is the living blueprint. Update it as features evolve.*
*Created: April 10, 2026*
