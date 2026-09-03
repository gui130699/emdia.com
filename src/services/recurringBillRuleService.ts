import { addDays, addMonths, addYears } from "date-fns";
import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { accountService, type AccountBillInput } from "./accountService";
import { toDateInputValue } from "../utils/date";
import type { AccountBill, RecurringBillRule, RecurringFrequency } from "../types/finance";

const store = createRepository<RecurringBillRule>("recurringBillRules");

/** How far ahead occurrences are generated on every check — a rolling
 * window, not "generate forever", per the no-infinite-future-bills rule. */
const WINDOW_MONTHS_AHEAD = 4;

export interface RecurringBillRuleInput {
  description: string;
  categoryId: string;
  amountType: RecurringBillRule["amountType"];
  defaultAmount: number;
  estimatedAmount?: number;
  frequency: RecurringFrequency;
  startDate: string;
  endType: RecurringBillRule["endType"];
  endDate?: string;
  maxOccurrences?: number;
  dayOfMonth?: number;
  paymentMethod?: RecurringBillRule["paymentMethod"];
  accountId?: string;
  cardId?: string;
}

function clampToMonthLength(date: Date, day: number): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const result = new Date(date);
  result.setDate(Math.min(day, lastDay));
  return result;
}

function stepDate(date: Date, frequency: RecurringFrequency, dayOfMonth?: number): Date {
  let next: Date;
  switch (frequency) {
    case "weekly":
      next = addDays(date, 7);
      break;
    case "monthly":
      next = addMonths(date, 1);
      break;
    case "quarterly":
      next = addMonths(date, 3);
      break;
    case "semiannual":
      next = addMonths(date, 6);
      break;
    case "yearly":
      next = addYears(date, 1);
      break;
  }
  return dayOfMonth && frequency !== "weekly" ? clampToMonthLength(next, dayOfMonth) : next;
}

export const recurringBillRuleService = {
  list: (userId: string) => store.list(userId),
  get: (userId: string, id: string) => store.get(userId, id),

  async create(userId: string, input: RecurringBillRuleInput): Promise<RecurringBillRule> {
    const now = new Date().toISOString();
    const rule: RecurringBillRule = {
      id: generateId(),
      userId,
      ...input,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, rule);
  },

  /** Edits the rule itself. When `cascadeToFuture` is true, every
   * not-yet-paid occurrence (today or later) is updated to match — paid
   * history is never touched. "Somente esta cobrança" doesn't go through
   * here at all: that's just a normal single-bill edit via accountService. */
  async update(
    userId: string,
    id: string,
    patch: Partial<RecurringBillRuleInput>,
    cascadeToFuture: boolean,
    allBills: AccountBill[]
  ): Promise<void> {
    await store.update(userId, id, { ...patch, updatedAt: new Date().toISOString() });

    if (cascadeToFuture) {
      const today = toDateInputValue(new Date());
      const affected = allBills.filter((b) => b.recurringRuleId === id && b.status !== "paid" && b.dueDate >= today);
      for (const bill of affected) {
        const billPatch: Partial<AccountBillInput> = {};
        if (patch.description !== undefined) billPatch.description = patch.description;
        if (patch.categoryId !== undefined) billPatch.categoryId = patch.categoryId;
        if (patch.defaultAmount !== undefined) billPatch.amount = patch.defaultAmount;
        if (patch.paymentMethod !== undefined) billPatch.paymentMethod = patch.paymentMethod;
        if (patch.accountId !== undefined) billPatch.accountId = patch.accountId;
        if (Object.keys(billPatch).length > 0) {
          await accountService.update(userId, bill.id, billPatch);
        }
      }
    }
  },

  /** Generates every occurrence due between the rule's last known
   * occurrence (or startDate, if it never generated one) and today + a
   * rolling window — never further, and never re-creates one that already
   * exists for that due date (idempotent). */
  async generateOccurrences(userId: string, rule: RecurringBillRule, existingBills: AccountBill[]): Promise<void> {
    if (rule.status !== "active") return;

    const ruleOccurrences = existingBills.filter((b) => b.recurringRuleId === rule.id);
    const horizon = addMonths(new Date(), WINDOW_MONTHS_AHEAD);
    const endDateLimit = rule.endType === "date" && rule.endDate ? new Date(rule.endDate + "T00:00:00") : null;

    let cursor: Date;
    let occurrenceCount = ruleOccurrences.length;
    if (ruleOccurrences.length === 0) {
      cursor = new Date(rule.startDate + "T00:00:00");
    } else {
      const lastDueDate = ruleOccurrences.map((b) => b.dueDate).sort().at(-1)!;
      cursor = stepDate(new Date(lastDueDate + "T00:00:00"), rule.frequency, rule.dayOfMonth);
    }

    const existingDueDates = new Set(ruleOccurrences.map((b) => b.dueDate));

    while (cursor <= horizon) {
      if (rule.endType === "occurrences" && rule.maxOccurrences && occurrenceCount >= rule.maxOccurrences) break;
      if (endDateLimit && cursor > endDateLimit) break;

      const dueDate = toDateInputValue(cursor);
      if (!existingDueDates.has(dueDate)) {
        await accountService.create(userId, {
          description: rule.description,
          amount: rule.amountType === "fixed" ? rule.defaultAmount : rule.estimatedAmount ?? rule.defaultAmount,
          dueDate,
          categoryId: rule.categoryId,
          recurring: true,
          recurringRuleId: rule.id,
          paymentMethod: rule.paymentMethod,
          accountId: rule.accountId,
          notes: rule.amountType === "variable" ? "Valor estimado — pode ser ajustado ao pagar." : undefined,
        });
        occurrenceCount++;
      }
      cursor = stepDate(cursor, rule.frequency, rule.dayOfMonth);
    }
  },

  async generateForAllActiveRules(userId: string): Promise<void> {
    const [rules, bills] = await Promise.all([store.list(userId), accountService.list(userId)]);
    for (const rule of rules) {
      if (rule.status === "active") {
        await this.generateOccurrences(userId, rule, bills);
      }
    }
  },

  /** Stops generating new occurrences. Optionally removes future
   * not-yet-paid ones the user no longer wants — paid history is always
   * preserved. */
  async pause(userId: string, id: string, removeFutureUnpaid: boolean, allBills: AccountBill[]): Promise<void> {
    await store.update(userId, id, { status: "paused", updatedAt: new Date().toISOString() });
    if (removeFutureUnpaid) {
      await this.removeUnpaidOccurrences(userId, id, allBills);
    }
  },

  async reactivate(userId: string, id: string): Promise<void> {
    await store.update(userId, id, { status: "active", updatedAt: new Date().toISOString() });
  },

  /** Ends the rule permanently. Paid occurrences are always kept; pending
   * and future ones are removed only if the user opts in. */
  async end(userId: string, id: string, removeFutureUnpaid: boolean, allBills: AccountBill[]): Promise<void> {
    await store.update(userId, id, { status: "ended", updatedAt: new Date().toISOString() });
    if (removeFutureUnpaid) {
      await this.removeUnpaidOccurrences(userId, id, allBills);
    }
  },

  async removeUnpaidOccurrences(userId: string, ruleId: string, allBills: AccountBill[]): Promise<void> {
    const unpaid = allBills.filter((b) => b.recurringRuleId === ruleId && b.status !== "paid");
    for (const bill of unpaid) {
      await accountService.remove(userId, bill.id);
    }
  },

  /** Only allowed when the rule never produced a single paid occurrence —
   * otherwise real payment history would be lost. Use `end` instead. */
  async deleteRule(userId: string, id: string, allBills: AccountBill[]): Promise<{ ok: boolean; reason?: string }> {
    const occurrences = allBills.filter((b) => b.recurringRuleId === id);
    const hasPaidHistory = occurrences.some((b) => b.status === "paid");
    if (hasPaidHistory) {
      return { ok: false, reason: "Esta recorrência já possui cobranças pagas — encerre a regra em vez de excluí-la, para preservar o histórico." };
    }
    for (const bill of occurrences) {
      await accountService.remove(userId, bill.id);
    }
    await store.remove(userId, id);
    return { ok: true };
  },
};
