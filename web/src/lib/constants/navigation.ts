import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  PiggyBank,
  CreditCard,
  BarChart3,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Income", href: "/income", icon: ArrowUpCircle },
  { label: "Expenses", href: "/expenses", icon: ArrowDownCircle },
  { label: "Savings Goals", href: "/goals", icon: PiggyBank },
  { label: "Debts", href: "/debts", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
