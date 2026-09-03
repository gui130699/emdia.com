import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { Invoice } from "../types/finance";
import type { InvoicePeriod } from "../utils/cardInvoice";

const store = createRepository<Invoice>("invoices");

export const invoiceService = {
  list: (userId: string) => store.list(userId),
  get: (userId: string, id: string) => store.get(userId, id),

  async findByPeriod(userId: string, cardId: string, periodKey: string): Promise<Invoice | undefined> {
    const all = await store.list(userId);
    return all.find((inv) => inv.cardId === cardId && inv.periodKey === periodKey);
  },

  /** Persists a paid invoice record for a cycle that was previously only
   * computed on the fly. Only paid/settled cycles need a real document —
   * open/overdue cycles keep being derived from transactions dynamically. */
  async recordPayment(
    userId: string,
    cardId: string,
    period: InvoicePeriod,
    total: number,
    paidAccountId: string,
    paymentTransactionId: string,
    id?: string
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    const existing = await this.findByPeriod(userId, cardId, period.periodKey);
    const invoice: Invoice = {
      id: existing?.id ?? id ?? generateId(),
      userId,
      cardId,
      periodKey: period.periodKey,
      periodStart: period.cycleStart.toISOString().slice(0, 10),
      periodEnd: period.cycleEnd.toISOString().slice(0, 10),
      closingDate: period.cycleEnd.toISOString().slice(0, 10),
      dueDate: period.dueDate.toISOString().slice(0, 10),
      total,
      status: "paid",
      paidAt: now,
      paidAmount: total,
      paidAccountId,
      paymentTransactionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return store.create(userId, invoice);
  },

  /** Removes the paid record — the cycle falls back to being computed
   * dynamically as open/closed/overdue from its transactions again. */
  remove: (userId: string, id: string) => store.remove(userId, id),
};
