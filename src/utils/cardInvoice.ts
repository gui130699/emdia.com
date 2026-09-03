import { format } from "date-fns";
import type { CreditCard, Transaction } from "../types/finance";

export interface InvoicePeriod {
  cycleStart: Date;
  cycleEnd: Date;
  dueDate: Date;
  periodKey: string;
}

function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function getCurrentInvoicePeriod(card: CreditCard, reference: Date = new Date()): InvoicePeriod {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  let cycleEnd = clampDay(year, month, card.closingDay);
  if (reference > cycleEnd) {
    cycleEnd = clampDay(year, month + 1, card.closingDay);
  }

  const prevCycleEndMonth = cycleEnd.getMonth() - 1;
  const cycleStart = clampDay(cycleEnd.getFullYear(), prevCycleEndMonth, card.closingDay);
  cycleStart.setDate(cycleStart.getDate() + 1);

  let dueDate = clampDay(cycleEnd.getFullYear(), cycleEnd.getMonth(), card.dueDay);
  if (dueDate <= cycleEnd) {
    dueDate = clampDay(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, card.dueDay);
  }

  return { cycleStart, cycleEnd, dueDate, periodKey: format(cycleEnd, "yyyy-MM") };
}

export function transactionsInPeriod(transactions: Transaction[], cardId: string, period: InvoicePeriod): Transaction[] {
  return transactions.filter((t) => {
    if (t.cardId !== cardId) return false;
    const date = new Date(t.date + "T00:00:00");
    return date >= period.cycleStart && date <= period.cycleEnd;
  });
}

/** A refund/credit/payment-received line reduces what's owed on the
 * invoice — summing every card transaction as a flat positive would count
 * a refund as another purchase instead of cancelling one out. */
export function signedCardAmount(t: Transaction): number {
  if (t.cardEntryType === "refund" || t.cardEntryType === "credit" || t.cardEntryType === "credit_card_payment") {
    return -t.amount;
  }
  return t.amount;
}

export function invoiceTotalForPeriod(transactions: Transaction[], cardId: string, period: InvoicePeriod): number {
  return transactionsInPeriod(transactions, cardId, period).reduce((sum, t) => sum + signedCardAmount(t), 0);
}
