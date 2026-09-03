import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { InvoicePayment } from "../types/finance";

const store = createRepository<InvoicePayment>("invoicePayments");

export interface CreateInvoicePaymentInput {
  invoiceId: string;
  cardId: string;
  amount: number;
  paymentDate: string;
  bankAccountId?: string;
  bankTransactionId?: string;
  cardStatementTransactionId?: string;
  source: InvoicePayment["source"];
  status?: InvoicePayment["status"];
  confidenceScore?: number;
}

export const invoicePaymentService = {
  list: (userId: string) => store.list(userId),

  async listForInvoice(userId: string, invoiceId: string): Promise<InvoicePayment[]> {
    return (await store.list(userId))
      .filter((payment) => payment.invoiceId === invoiceId)
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  },

  async create(userId: string, input: CreateInvoicePaymentInput): Promise<InvoicePayment> {
    const existing = input.bankTransactionId
      ? (await store.list(userId)).find(
          (payment) =>
            payment.bankTransactionId === input.bankTransactionId &&
            payment.status !== "reversed"
        )
      : undefined;
    if (existing) return existing;

    const now = new Date().toISOString();
    const payment: InvoicePayment = {
      id: generateId(),
      userId,
      ...input,
      status: input.status ?? "confirmed",
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, payment);
  },

  async reverseForInvoice(userId: string, invoiceId: string): Promise<InvoicePayment[]> {
    const payments = await this.listForInvoice(userId, invoiceId);
    const reversed: InvoicePayment[] = [];
    for (const payment of payments.filter((candidate) => candidate.status !== "reversed")) {
      const updated = await store.update(userId, payment.id, {
        status: "reversed",
        updatedAt: new Date().toISOString(),
      });
      if (updated) reversed.push(updated);
    }
    return reversed;
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
