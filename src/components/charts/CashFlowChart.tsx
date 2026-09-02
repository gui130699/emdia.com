import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/currency";
import { formatAxisCurrency } from "../../utils/chartFormat";

export interface CashFlowPoint {
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export default function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-100)" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} />
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
            backgroundColor: "var(--color-white)",
            color: "var(--color-ink-900)",
            fontSize: 13,
          }}
        />
        <Bar dataKey="income" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} barSize={16} />
        <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
        <Line type="monotone" dataKey="balance" name="Saldo" stroke="var(--color-ink-400)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
