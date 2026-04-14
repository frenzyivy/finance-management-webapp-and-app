"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { SubscriptionTrendPoint } from "@/hooks/use-business-analytics";

interface SubscriptionTrendChartProps {
  data: SubscriptionTrendPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md space-y-0.5">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === "plannedBurn" ? "Planned burn" : "Actual spend"}:{" "}
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function SubscriptionTrendChart({ data }: SubscriptionTrendChartProps) {
  if (data.length === 0 || data.every((d) => d.actualSpend === 0 && d.plannedBurn === 0)) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        No subscription data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) =>
            value === "plannedBurn" ? "Planned burn" : "Actual spend"
          }
        />
        <Bar dataKey="actualSpend" fill="#0891B2" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="plannedBurn"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: "#f59e0b" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}