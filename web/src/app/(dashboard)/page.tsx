import {
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  PiggyBank,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

const summaryCards = [
  {
    title: "Total Income",
    amount: 0,
    icon: ArrowUpCircle,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    title: "Total Expenses",
    amount: 0,
    icon: ArrowDownCircle,
    iconColor: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  {
    title: "Net Cash Flow",
    amount: 0,
    icon: TrendingUp,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    title: "Savings Progress",
    amount: 0,
    icon: PiggyBank,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Your financial overview at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bgColor}`}
                >
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(card.amount)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
