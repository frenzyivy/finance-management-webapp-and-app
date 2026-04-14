import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  PiggyBank,
  CreditCard,
  BarChart3,
  FileUp,
  Settings,
  Building2,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  accent?: "teal" | "blue";
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Personal",
    accent: "teal",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Income", href: "/income", icon: ArrowUpCircle },
      { label: "Expenses", href: "/expenses", icon: ArrowDownCircle },
      { label: "Savings Goals", href: "/goals", icon: PiggyBank },
      { label: "Debts", href: "/debts", icon: CreditCard },
    ],
  },
  {
    title: "Business",
    accent: "blue",
    items: [
      { label: "Allianza Biz", href: "/business", icon: Building2 },
      { label: "Subscriptions", href: "/business/subscriptions", icon: CalendarClock },
      { label: "Biz Analytics", href: "/business/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    accent: "teal",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Imports", href: "/imports", icon: FileUp },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Flat list for backward compatibility
export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
