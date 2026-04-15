import React from "react";

// Shared emoji + background map — see KOMALFI_DESIGN_SYSTEM.md §3.8
// Expense categories (13 real + 1 fallback) and income categories (4 real).

type CategoryMeta = { emoji: string; bg: string };

const EXPENSE_CATEGORIES: Record<string, CategoryMeta> = {
  rent: { emoji: "🏠", bg: "#E3F2FD" },
  food: { emoji: "🍔", bg: "#FFF3E0" },
  groceries: { emoji: "🛒", bg: "#FFF3E0" },
  utilities: { emoji: "⚡", bg: "#EDE7F6" },
  shopping: { emoji: "🛍️", bg: "#FFF8E1" },
  transport: { emoji: "🚕", bg: "#E0F7FA" },
  health: { emoji: "🩺", bg: "#FEF0EF" },
  education: { emoji: "📚", bg: "#E3F2FD" },
  entertainment: { emoji: "🎬", bg: "#F3E5F5" },
  subscriptions: { emoji: "🔁", bg: "#EDE7F6" },
  emi: { emoji: "📅", bg: "#E3F2FD" },
  credit_card: { emoji: "💳", bg: "#E3F2FD" },
  family: { emoji: "👨‍👩‍👧", bg: "#FFF8E1" },
  personal: { emoji: "👤", bg: "#E8F5F0" },
  miscellaneous: { emoji: "🎁", bg: "#E8F5F0" },
  other: { emoji: "🎁", bg: "#E8F5F0" },
};

const INCOME_CATEGORIES: Record<string, CategoryMeta> = {
  salary: { emoji: "💼", bg: "#E8F5F0" },
  freelance: { emoji: "💼", bg: "#F3E5F5" },
  borrowed: { emoji: "🤝", bg: "#FFF8E1" },
  borrowed_money: { emoji: "🤝", bg: "#FFF8E1" },
  side_income: { emoji: "✨", bg: "#E0F7FA" },
  other: { emoji: "🎁", bg: "#E8F5F0" },
};

function lookup(kind: "income" | "expense" | "transfer", category?: string | null): CategoryMeta {
  if (kind === "transfer") return { emoji: "🔁", bg: "#F3E5F5" };
  const map = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const key = (category || "other").toLowerCase();
  return map[key] || map.other;
}

interface CategoryIconProps {
  kind: "income" | "expense" | "transfer";
  category?: string | null;
  size?: number;
  /** Override the emoji. */
  emoji?: string;
}

export function CategoryIcon({ kind, category, size = 42, emoji }: CategoryIconProps) {
  const meta = lookup(kind, category);
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: meta.bg,
        fontSize: Math.round(size * 0.43),
      }}
    >
      {emoji || meta.emoji}
    </span>
  );
}

export function getCategoryMeta(kind: "income" | "expense" | "transfer", category?: string | null) {
  return lookup(kind, category);
}
