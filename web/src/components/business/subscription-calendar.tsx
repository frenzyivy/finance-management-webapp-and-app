"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BusinessSubscription } from "@/types/business";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface SubscriptionCalendarProps {
  subscriptions: BusinessSubscription[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getUrgency(renewalDate: string, today: string): "today" | "soon" | "later" {
  if (renewalDate === today) return "today";
  const diffDays = Math.floor(
    (new Date(renewalDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > 0 && diffDays <= 3) return "soon";
  return "later";
}

export function SubscriptionCalendar({ subscriptions }: SubscriptionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = toIsoDate(new Date());

  // Only show active subscriptions on calendar
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === "active" || s.status === "trial"),
    [subscriptions]
  );

  // Map date → subscriptions renewing that day
  const renewalMap = useMemo(() => {
    const map = new Map<string, BusinessSubscription[]>();
    for (const sub of activeSubscriptions) {
      const key = sub.next_renewal_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sub);
    }
    return map;
  }, [activeSubscriptions]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);

  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const cells: Array<{ day: number | null; isoDate: string | null }> = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push({ day: null, isoDate: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month, day);
    cells.push({ day, isoDate: toIsoDate(dt) });
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={goPrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={goNext}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span>Due today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Within 3 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Later</span>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-xs font-semibold text-muted-foreground text-center py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell.day === null) {
            return <div key={idx} className="aspect-square" />;
          }
          const renewals = renewalMap.get(cell.isoDate!) ?? [];
          const isToday = cell.isoDate === today;
          const hasRenewals = renewals.length > 0;

          const cellContent = (
            <div
              className={cn(
                "aspect-square rounded-md border flex flex-col items-center justify-start p-1.5 transition-colors",
                isToday && "border-blue-500 bg-blue-50 dark:bg-blue-950 border-2",
                !isToday && "border-border",
                hasRenewals && "cursor-pointer hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isToday && "text-blue-700 dark:text-blue-300 font-bold"
                )}
              >
                {cell.day}
              </span>
              {hasRenewals && (
                <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                  {renewals.slice(0, 3).map((r) => {
                    const urgency = getUrgency(r.next_renewal_date, today);
                    return (
                      <span
                        key={r.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          urgency === "today" && "bg-red-500",
                          urgency === "soon" && "bg-amber-500",
                          urgency === "later" && "bg-emerald-500"
                        )}
                      />
                    );
                  })}
                  {renewals.length > 3 && (
                    <span className="text-[9px] leading-none text-muted-foreground ml-0.5">
                      +{renewals.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );

          if (!hasRenewals) {
            return <div key={idx}>{cellContent}</div>;
          }

          return (
            <Popover key={idx}>
              <PopoverTrigger asChild>{cellContent}</PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    {renewals.length} renewal{renewals.length !== 1 ? "s" : ""} on{" "}
                    {new Date(cell.isoDate!).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  {renewals.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 pb-2 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {r.billing_cycle}
                        </p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">
                        {formatCurrency(r.cost_amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </Card>
  );
}
