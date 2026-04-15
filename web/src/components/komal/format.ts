// Shared formatting helpers for the KomalFi component library.

/**
 * Indian-grouped number without currency symbol.
 * Hero and stat cards render the ₹ symbol separately at a smaller weight
 * per KOMALFI_DESIGN_SYSTEM.md §2.2.
 */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

/** Full currency format with symbol, e.g. ₹12,345. */
export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
