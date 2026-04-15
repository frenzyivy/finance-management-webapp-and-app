// KomalFi design tokens — see KOMALFI_DESIGN_SYSTEM.md §2.1
// Shape matches web globals.css so cross-platform visuals stay in sync.

export const lightColors = {
  bg: "#F6F5F2",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EFEB",

  textPrimary: "#1A1A1A",
  textSecondary: "#7A7A7A",
  textTertiary: "#A8A8A8",

  accent: "#0D9373",
  accentLight: "#E8F5F0",
  expense: "#E8453C",
  expenseLight: "#FEF0EF",
  income: "#0D9373",
  incomeLight: "#E8F5F0",
  warning: "#F5A623",

  border: "rgba(0,0,0,0.06)",
  shadow: "rgba(0,0,0,0.06)",

  // Legacy aliases — keep until all screens migrate off the old keys.
  background: "#F6F5F2",
  card: "#FFFFFF",
  cardAlt: "#F0EFEB",
  text: "#1A1A1A",
  textMuted: "#A8A8A8",
  inputBg: "#F0EFEB",
  teal: "#0D9373",
  green: "#0D9373",
  red: "#E8453C",
  amber: "#F5A623",
  blue: "#42A5F5",
  purple: "#AB47BC",
};

export const darkColors = {
  bg: "#111110",
  surface: "#1C1C1B",
  surfaceAlt: "#252523",

  textPrimary: "#F6F5F2",
  textSecondary: "#A8A8A8",
  textTertiary: "#7A7A7A",

  accent: "#0D9373",
  accentLight: "rgba(13,147,115,0.16)",
  expense: "#E8453C",
  expenseLight: "rgba(232,69,60,0.16)",
  income: "#0D9373",
  incomeLight: "rgba(13,147,115,0.16)",
  warning: "#F5A623",

  border: "rgba(255,255,255,0.08)",
  shadow: "rgba(0,0,0,0.5)",

  background: "#111110",
  card: "#1C1C1B",
  cardAlt: "#252523",
  text: "#F6F5F2",
  textMuted: "#7A7A7A",
  inputBg: "#252523",
  teal: "#0D9373",
  green: "#0D9373",
  red: "#E8453C",
  amber: "#F5A623",
  blue: "#42A5F5",
  purple: "#AB47BC",
};

export type ThemeColors = typeof lightColors;
