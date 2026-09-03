import { subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import type { Category, Transaction } from "../types/finance";
import { formatMonthLabel } from "../utils/date";

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
}

export function sumByType(transactions: Transaction[]): PeriodTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    // Internal transfers between the user's own accounts are neither
    // income nor expense — counting them would inflate both sides.
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function filterByPeriod(
  transactions: Transaction[],
  start: Date,
  end: Date
): Transaction[] {
  return transactions.filter((t) =>
    isWithinInterval(parseISO(t.date), { start, end })
  );
}

export function growthPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expense: number;
}

export function monthlyEvolution(transactions: Transaction[], monthsBack: number): MonthlyPoint[] {
  const now = new Date();
  const points: MonthlyPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const reference = subMonths(now, i);
    const start = startOfMonth(reference);
    const end = endOfMonth(reference);
    const inMonth = filterByPeriod(transactions, start, end);
    const totals = sumByType(inMonth);
    points.push({ month: formatMonthLabel(reference), income: totals.income, expense: totals.expense });
  }

  return points;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  value: number;
  percent: number;
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: Transaction["type"]
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((t) => t.type === type);
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = new Map<string, number>();

  for (const t of filtered) {
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  return Array.from(byCategory.entries())
    .map(([categoryId, value]) => {
      const category = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: category?.name ?? "Outros",
        color: category?.color ?? "#94a3b8",
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function generateInsights(
  currentPeriod: Transaction[],
  previousPeriod: Transaction[],
  categories: Category[]
): string[] {
  const insights: string[] = [];

  const expenseBreakdown = categoryBreakdown(currentPeriod, categories, "expense");
  if (expenseBreakdown.length > 0) {
    const top = expenseBreakdown[0];
    insights.push(
      `Seu maior gasto foi ${top.name}, representando ${top.percent.toFixed(0)}% das suas despesas.`
    );
  }

  const currentTotals = sumByType(currentPeriod);
  const previousTotals = sumByType(previousPeriod);
  if (previousTotals.balance !== 0 || currentTotals.balance !== 0) {
    if (currentTotals.balance > previousTotals.balance) {
      insights.push("Você economizou mais que no período anterior. Continue assim!");
    } else if (currentTotals.balance < previousTotals.balance) {
      insights.push("Sua economia caiu em relação ao período anterior.");
    }
  }

  const previousExpenseBreakdown = categoryBreakdown(previousPeriod, categories, "expense");
  for (const item of expenseBreakdown) {
    const previous = previousExpenseBreakdown.find((p) => p.categoryId === item.categoryId);
    if (previous && previous.value > 0) {
      const change = growthPercent(item.value, previous.value);
      if (change <= -10) {
        insights.push(
          `Seus gastos com ${item.name} diminuíram ${Math.abs(change).toFixed(0)}% em relação ao período anterior.`
        );
        break;
      }
    }
  }

  return insights;
}
