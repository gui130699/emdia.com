import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryBreakdownItem } from "../../services/reportService";
import { formatCurrency } from "../../utils/currency";

interface CategoryChartProps {
  data: CategoryBreakdownItem[];
  total: number;
}

export default function CategoryChart({ data, total }: CategoryChartProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} stroke="none" />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-ink-400">Total</span>
          <span className="text-base font-bold text-ink-900">{formatCurrency(total)}</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5">
        {data.map((item) => (
          <li key={item.categoryId} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-ink-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="flex items-center gap-3 text-ink-500">
              <span className="w-10 text-right text-xs">{item.percent.toFixed(0)}%</span>
              <span className="font-semibold text-ink-900">{formatCurrency(item.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
