"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { ClientRevenue } from "@/hooks/use-business-analytics";

interface RevenueByClientChartProps {
  data: ClientRevenue[];
  limit?: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ClientRevenue }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md space-y-0.5">
      <p className="font-medium">{row.clientName}</p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Revenue: {formatCurrency(row.revenue)}
      </p>
      {row.attributedExpenses > 0 && (
        <p className="text-red-600 dark:text-red-400">
          Attributed expenses: {formatCurrency(row.attributedExpenses)}
        </p>
      )}
      <p className={row.profit >= 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
        Profit: {formatCurrency(row.profit)}{" "}
        ({row.margin.toFixed(1)}%)
      </p>
    </div>
  );
}

export function RevenueByClientChart({ data, limit = 10 }: RevenueByClientChartProps) {
  const sliced = data.slice(0, limit);

  if (sliced.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        No client revenue yet — link business income to a client to see this chart.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, sliced.length * 40 + 40)}>
      <BarChart
        data={sliced}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <YAxis
          type="category"
          dataKey="clientName"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          width={100}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
          {sliced.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.profit >= 0 ? "#185FA5" : "#dc2626"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
