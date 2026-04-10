import { format, parseISO } from "date-fns";

export function formatDate(
  date: string | Date,
  fmt: string = "dd MMM yyyy"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatMonth(date: string | Date): string {
  return formatDate(date, "MMMM yyyy");
}
