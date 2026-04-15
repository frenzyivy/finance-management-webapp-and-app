"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  HeroBalanceCard,
  QuickActionBar,
  StatPillRow,
  SectionHeader,
  TransactionCard,
  formatINR,
} from "@/components/komal";
import { HeaderIconButton } from "@/components/layout/PageHeader";

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  savingsProgress: number;
}

interface Transaction {
  id: string;
  kind: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
  method?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData>({
    totalIncome: 0,
    totalExpenses: 0,
    savingsProgress: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("there");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();

        const { data: userData } = await supabase.auth.getUser();
        const metaName =
          (userData?.user?.user_metadata?.full_name as string | undefined) ||
          (userData?.user?.user_metadata?.name as string | undefined) ||
          userData?.user?.email?.split("@")[0] ||
          "there";
        setUserName(metaName);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        ).toISOString();

        const [incomeRes, expenseRes, savingsRes, recentIncomeRes, recentExpenseRes] =
          await Promise.all([
            supabase
              .from("income_entries")
              .select("amount")
              .gte("date", startOfMonth)
              .lte("date", endOfMonth),
            supabase
              .from("expense_entries")
              .select("amount")
              .gte("date", startOfMonth)
              .lte("date", endOfMonth),
            supabase.from("savings_goals").select("current_balance"),
            supabase
              .from("income_entries")
              .select("id, source_name, category, date, amount, payment_method")
              .order("date", { ascending: false })
              .limit(6),
            supabase
              .from("expense_entries")
              .select("id, payee_name, category, date, amount, payment_method")
              .order("date", { ascending: false })
              .limit(6),
          ]);

        const totalIncome = (incomeRes.data || []).reduce(
          (s, r) => s + (Number(r.amount) || 0),
          0
        );
        const totalExpenses = (expenseRes.data || []).reduce(
          (s, r) => s + (Number(r.amount) || 0),
          0
        );
        const savingsProgress = (savingsRes.data || []).reduce(
          (s, r) => s + (Number(r.current_balance) || 0),
          0
        );

        setSummary({ totalIncome, totalExpenses, savingsProgress });

        const income: Transaction[] = (recentIncomeRes.data || []).map((r) => ({
          id: r.id,
          kind: "income",
          description: r.source_name,
          category: r.category || "other",
          date: r.date,
          amount: Number(r.amount),
          method: r.payment_method,
        }));
        const expense: Transaction[] = (recentExpenseRes.data || []).map((r) => ({
          id: r.id,
          kind: "expense",
          description: r.payee_name,
          category: r.category || "other",
          date: r.date,
          amount: Number(r.amount),
          method: r.payment_method,
        }));

        const merged = [...income, ...expense]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 6);

        setTransactions(merged);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        toast.error("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const netCashFlow = summary.totalIncome - summary.totalExpenses;

  return (
    <div className="flex flex-col">
      {/* Dashboard header — greeting + icon row (MD §3.1) */}
      <div className="flex items-center justify-between px-6 pt-[52px] pb-5 animate d1">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            Hi,
          </span>
          <span
            className="font-[family-name:var(--font-instrument-serif)] text-[26px] leading-none text-[var(--text-primary)] mt-0.5"
            style={{ letterSpacing: "-0.01em" }}
          >
            {userName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <HeaderIconButton aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </HeaderIconButton>
          <HeaderIconButton
            aria-label="Settings"
            onClick={() => router.push("/settings")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.61.78 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.73 0-1.31.39-1.51 1Z" />
            </svg>
          </HeaderIconButton>
        </div>
      </div>

      <div className="animate d2">
        <HeroBalanceCard
          netAmount={netCashFlow}
          income={summary.totalIncome}
          expense={summary.totalExpenses}
        />
      </div>

      <div className="animate d3">
        <QuickActionBar
          actions={[
            {
              label: "Import",
              href: "/imports",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5M12 15V3" />
                </svg>
              ),
            },
            {
              label: "Add Entry",
              onClick: () => router.push("/expenses?new=1"),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              ),
            },
            {
              label: "Filter",
              onClick: () => router.push("/analytics"),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16l-6 8v6l-4 2v-8Z" />
                </svg>
              ),
            },
          ]}
        />
      </div>

      <div className="animate d4">
        <StatPillRow
          stats={[
            {
              label: "Savings",
              value: formatINR(summary.savingsProgress),
              tone: summary.savingsProgress === 0 ? "zero" : "default",
            },
            {
              label: "This Month",
              value: formatINR(Math.abs(netCashFlow)),
              tone: netCashFlow < 0 ? "negative" : "default",
            },
          ]}
        />
      </div>

      <div className="animate d5">
        <SectionHeader title="Recent" linkLabel="View All" linkHref="/expenses" />
      </div>

      <div className="flex flex-col gap-1.5 pb-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="mx-6 h-[70px] animate-pulse rounded-[12px] bg-[var(--surface-alt)]"
            />
          ))
        ) : transactions.length === 0 ? (
          <div className="mx-6 text-center text-[var(--text-secondary)] py-8 text-sm">
            No transactions yet. Tap + to add one.
          </div>
        ) : (
          transactions.map((tx, idx) => (
            <div
              key={`${tx.kind}-${tx.id}`}
              className={`animate d${Math.min(idx + 6, 10)} mx-6`}
            >
              <TransactionCard
                name={tx.description || "—"}
                kind={tx.kind}
                category={tx.category}
                categoryLabel={prettyCategory(tx.category)}
                date={format(new Date(tx.date), "d MMM")}
                method={tx.method || undefined}
                amount={tx.amount}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function prettyCategory(c: string) {
  if (!c) return "Other";
  return c
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
