import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { invoicePaymentService } from "./invoicePaymentService";
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
    id?: string,
    source: "manual" | "import" | "reconciliation" = "manual",
    paymentDate: string = new Date().toISOString().slice(0, 10)
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    const existing = await this.findByPeriod(userId, cardId, period.periodKey);
    const invoiceId = existing?.id ?? id ?? generateId();
    await invoicePaymentService.create(userId, {
      invoiceId,
      cardId,
      amount: paidAmount,
      paymentDate,
      bankAccountId: paidAccountId,
      bankTransactionId: paymentTransactionId,
      source,
      status: "confirmed",
    });
    const payments = await invoicePaymentService.listForInvoice(userId, invoiceId);
    const totalPaid = payments
      .filter((payment) => payment.status !== "reversed")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = Math.max(0, total - totalPaid);
    const invoice: Invoice = {
      ...existing,
      id: invoiceId,
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
    period: InvoicePeriod | undefined,
    statement: {
      statementBalance: number;
      rawStatementBalance?: number;
      asOfDate?: string;
      asOfDateTime?: string;
      periodStart?: string;
      periodEnd?: string;
      importBatchId?: string;
    },
    computedTotal: number,
    composition?: Pick<Invoice, "purchaseTotal" | "installmentTotal" | "chargesTotal" | "previousBalance" | "paymentsTotal" | "creditsTotal">
  ): Promise<Invoice> {
    const now = new Date().toISOString();
    const periodKey = period?.periodKey ?? statement.asOfDate?.slice(0, 7) ?? statement.periodEnd?.slice(0, 7) ?? now.slice(0, 7);
    const existing = await this.findByPeriod(userId, cardId, periodKey);
    const patch = {
      total: computedTotal,
      statementBalance: statement.statementBalance,
      rawStatementBalance: statement.rawStatementBalance,
      statementAsOfDateTime: statement.asOfDateTime,
      periodStart: period?.cycleStart.toISOString().slice(0, 10) ?? statement.periodStart,
      periodEnd: period?.cycleEnd.toISOString().slice(0, 10) ?? statement.periodEnd,
      closingDate: period?.cycleEnd.toISOString().slice(0, 10),
      dueDate: period?.dueDate.toISOString().slice(0, 10),
      remainingAmount: existing?.status === "paid" || existing?.status === "partial"
        ? existing.remainingAmount
        : statement.statementBalance,
      ...composition,
      updatedAt: now,
    };
    if (existing) {
      const updated = await store.update(userId, existing.id, patch);
      return updated as Invoice;
    }
    const today = new Date();
    const status: Invoice["status"] = period
      ? today > period.dueDate
        ? "overdue"
        : today > period.cycleEnd
          ? "closed"
          : "open"
      : "closed";
    const invoice: Invoice = {
      id: generateId(),
      userId,
      cardId,
      periodKey,
      ...patch,
      importBatchId: statement.importBatchId,
      status,
      createdAt: now,
    };
    return store.create(userId, invoice);
  },

  /** Removes the paid record — the cycle falls back to being computed
   * dynamically as open/closed/overdue from its transactions again. */
  remove: (userId: string, id: string) => store.remove(userId, id),

  /** Deletes just the Invoice document for an open/closed/overdue cycle —
   * refuses for a paid or partially-paid one, which must be reopened first
   * (that flow properly reverses each InvoicePayment and unmarks
   * installments instead of silently discarding payment history). Never
   * touches the underlying transactions: once the record is gone, the
   * cycle goes back to being computed dynamically from them, exactly like
   * before any statement was imported — the caller should tell the user
   * that explicitly rather than implying the purchases were removed too. */
  async deleteRecord(userId: string, invoiceId: string): Promise<{ ok: boolean; reason?: string; importBatchId?: string }> {
    const invoice = await store.get(userId, invoiceId);
    if (!invoice) return { ok: false, reason: "Fatura não encontrada." };
    if (invoice.status === "paid") {
      return { ok: false, reason: "Esta fatura está paga. Reabra o pagamento antes de excluir o registro." };
    }
    if (invoice.status === "partial") {
      return { ok: false, reason: "Esta fatura tem pagamento parcial. Desfaça os pagamentos antes de excluir o registro." };
    }
    const payments = await invoicePaymentService.listForInvoice(userId, invoiceId);
    if (payments.some((p) => p.status !== "reversed")) {
      return { ok: false, reason: "Esta fatura tem pagamentos registrados. Desfaça-os antes de excluir o registro." };
    }
    await store.remove(userId, invoiceId);
    return { ok: true, importBatchId: invoice.importBatchId };
  },
};
