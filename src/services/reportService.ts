import { subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import type { Category, Transaction } from "../types/finance";
import { formatMonthLabel } from "../utils/date";

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
}

/**
 * A card purchase (cardId set) never touches a bank account by itself —
 * only paying the invoice does, which is recorded as its own expense
 * transaction (accountId set, originType "credit_card_invoice"). Counting
 * both the purchase and the invoice payment as cash-flow expense would
 * double the real spend, so cash-flow totals only ever look at
 * account-side movements.
 */
export function isCashFlowTransaction(t: Transaction): boolean {
  return (t.type === "income" || t.type === "expense") && !t.cardId;
}

export function sumByType(transactions: Transaction[]): PeriodTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    // Internal transfers between the user's own accounts are neither
    // income nor expense — counting them would inflate both sides.
    if (!isCashFlowTransaction(t)) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
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
  // Same cash-flow scoping as sumByType: a card purchase's category shows
  // up in "Consumo no cartão" (cardConsumptionBreakdown), not here, so this
  // chart's total always matches the cash-flow expense/income summary above it.
  const filtered = transactions.filter((t) => t.type === type && !t.cardId);
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

const CARD_CONSUMPTION_TYPES: Array<Transaction["cardEntryType"]> = [
  undefined,
  "purchase",
  "installment",
  "cash_advance",
  "unknown",
];

/** Real new spending on a card — purchases, parcelas, saques — as opposed
 * to statement lines that just move money around (payments received,
 * previous balance carried over) or aren't spending at all (refunds,
 * charges). Shown as its own "Consumo no cartão" section since it doesn't
 * belong in the cash-flow expense total (see isCashFlowTransaction). */
export function cardConsumptionBreakdown(
  transactions: Transaction[],
  categories: Category[],
  cardId?: string
): CategoryBreakdownItem[] {
  const filtered = transactions.filter(
    (t) => !!t.cardId && (!cardId || t.cardId === cardId) && CARD_CONSUMPTION_TYPES.includes(t.cardEntryType)
  );
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

export interface CardStatementSummary {
  charges: number; // encargos financeiros: juros + iof + multa
  refunds: number; // estornos e créditos recebidos na fatura
  previousBalance: number; // saldo anterior transportado
  adjustments: number;
}

/** Breaks out the non-spending lines of an imported card statement so they
 * can be reported on their own instead of being silently folded into
 * "despesas" (which would misrepresent a previous-balance carry-over as new
 * spending, or a refund as an extra charge). */
export function cardStatementSummary(transactions: Transaction[]): CardStatementSummary {
  let charges = 0;
  let refunds = 0;
  let previousBalance = 0;
  let adjustments = 0;

  for (const t of transactions) {
    if (!t.cardId) continue;
    switch (t.cardEntryType) {
      case "interest":
      case "tax":
      case "penalty":
      case "fee":
        charges += t.amount;
        break;
      case "refund":
      case "credit":
        refunds += t.amount;
        break;
      case "previous_balance":
        previousBalance += t.amount;
        break;
      case "adjustment":
        adjustments += t.amount;
        break;
      default:
        break;
    }
  }

  return { charges, refunds, previousBalance, adjustments };
}

/** Sum of invoice payments made in the period — the cash-flow expense that
 * actually represents "paguei a fatura do cartão", already included in
 * sumByType's expense total (it's an account-side transaction) but useful
 * to show on its own since it summarizes potentially many card purchases. */
export function invoicePaymentsTotal(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense" && !t.cardId && t.originType === "credit_card_invoice")
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Sum of internal transfers between the user's own accounts in the
 * period — never income or expense, but worth surfacing as its own figure
 * so it doesn't just silently vanish from the reports. */
export function transfersTotal(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === "transfer").reduce((sum, t) => sum + t.amount, 0);
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
