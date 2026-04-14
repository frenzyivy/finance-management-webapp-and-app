"use client";

import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { PnLMonth } from "@/hooks/use-business-analytics";

interface PnLChartProps {
  data: PnLMonth[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; payload: PnLMonth }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md space-y-0.5">
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">
        Revenue: {formatCurrency(row.revenue)}
      </p>
      <p className="text-red-600 dark:text-red-400">
        Expenses: {formatCurrency(row.expenses)}
      </p>
      <p className={row.profit >= 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
        Profit: {formatCurrency(row.profit)}
      </p>
    </div>
  );
}

export function PnLChart({ data }: PnLChartProps) {
  if (data.length === 0 || data.every((d) => d.revenue === 0 && d.expenses === 0)) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        No P&amp;L data yet — add business income and expenses to see your profit trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
        <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke="#185FA5"
          strokeWidth={2}
          dot={{ r: 4, fill: "#185FA5" }}
          activeDot={{ r: 6 }}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.profit >= 0 ? "#185FA5" : "#dc2626"} />
          ))}
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}