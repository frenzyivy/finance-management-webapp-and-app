"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBreakdown } from "@/hooks/use-business-analytics";

interface ExpenseBreakdownChartProps {
  data: CategoryBreakdown[];
}

// Blue-family palette (matches business accent)
const COLORS = [
  "#185FA5", "#2B7FD0", "#4B9FE5", "#6BBAF0", "#93CBF1",
  "#0EA5E9", "#0284C7", "#075985", "#0891B2", "#06B6D4",
  "#22D3EE",
];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: CategoryBreakdown }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{row.label}</p>
      <p className="text-muted-foreground">
        {formatCurrency(row.amount)} ({row.percentage.toFixed(1)}%)
      </p>
    </div>
  );
}

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        No business expenses this month.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          layout="vertical"
          verticalAlign="middle"
          align="right"
          formatter={(value: string) => <span className="text-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}