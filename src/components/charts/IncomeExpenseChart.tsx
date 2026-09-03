import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyPoint } from "../../services/reportService";
import { formatCurrency } from "../../utils/currency";
import { formatAxisCurrency } from "../../utils/chartFormat";
import { useIsMobile } from "../../hooks/useIsMobile";

interface IncomeExpenseChartProps {
  data: MonthlyPoint[];
}

export default function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-100)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "var(--color-ink-400)" }}
          axisLine={false}
          tickLine={false}
          interval={isMobile ? "preserveStartEnd" : 0}
        />
        <YAxis
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            borderRadius: 12,
            borderColor: "var(--color-ink-100)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-ink-900)",
            fontSize: 13,
          }}
        />
        <Area type="monotone" dataKey="income" name="Receitas" stroke="#059669" fill="url(#income-gradient)" strokeWidth={2} />
        <Area type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" fill="url(#expense-gradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
