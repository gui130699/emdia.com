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

  /** Persists a paid (or partially paid) invoice record for a cycle that
   * was previously only computed on the fly. `total` is always the real
   * invoice total, independent of how much is actually being paid now —
   * paying less than that leaves the difference in `remainingAmount` and
   * the cycle as "partial" instead of silently treating it as settled,
   * which would otherwise erase the remaining debt from tracking. A second
   * partial payment on the same cycle accumulates onto the first instead
   * of overwriting it. */
  async recordPayment(
    userId: string,
    cardId: string,
    period: InvoicePeriod,
    total: number,
    paidAmount: number,
    paidAccountId: string,
    paymentTransactionId: string,
    id?: string
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    const existing = await this.findByPeriod(userId, cardId, period.periodKey);
    const totalPaid = (existing?.paidAmount ?? 0) + paidAmount;
    const remainingAmount = Math.max(0, total - totalPaid);
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
      remainingAmount,
      status: remainingAmount <= 0 ? "paid" : "partial",
      paidAt: now,
      paidAmount: totalPaid,
      paidAccountId,
      paymentTransactionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return store.create(userId, invoice);
  },

  /** Records the bank's own reported statement position for a cycle
   * (BALAMT from a card OFX) alongside what EM DIA computed from the
   * imported transactions — a mismatch usually means some statement lines
   * (saldo anterior, encargos, um pagamento) weren't selected during
   * import, not that either number is "wrong". Never touches payment state:
   * if the cycle is already paid/partial, only the reference figure is
   * updated. */
  async recordStatementSnapshot(
    userId: string,
    cardId: string,
    period: InvoicePeriod,
    statementBalance: number,
    computedTotal: number
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    const existing = await this.findByPeriod(userId, cardId, period.periodKey);
    if (existing) {
      await store.update(userId, existing.id, { statementBalance, updatedAt: now });
      return { ...existing, statementBalance, updatedAt: now };
    }
    const today = new Date();
    const status: Invoice["status"] = today > period.dueDate ? "overdue" : today > period.cycleEnd ? "closed" : "open";
    const invoice: Invoice = {
      id: generateId(),
      userId,
      cardId,
      periodKey: period.periodKey,
      periodStart: period.cycleStart.toISOString().slice(0, 10),
      periodEnd: period.cycleEnd.toISOString().slice(0, 10),
      closingDate: period.cycleEnd.toISOString().slice(0, 10),
      dueDate: period.dueDate.toISOString().slice(0, 10),
      total: computedTotal,
      statementBalance,
      status,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, invoice);
  },

  /** Removes the paid record — the cycle falls back to being computed
   * dynamically as open/closed/overdue from its transactions again. */
  remove: (userId: string, id: string) => store.remove(userId, id),
};
