import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { AccountBill } from "../types/finance";

const store = createRepository<AccountBill>("bills");

export interface AccountBillInput {
  description: string;
  amount: number;
  dueDate: string;
  categoryId: string;
  recurring: boolean;
  recurringFrequency?: AccountBill["recurringFrequency"];
  recurringRuleId?: string;
  paymentMethod?: AccountBill["paymentMethod"];
  accountId?: string;
  notes?: string;
}

export interface BillPaymentInput {
  paymentMethod: AccountBill["paymentMethod"];
  paidAt: string;
  paidAmount: number;
  paidAccountId?: string;
  paidCardId?: string;
  /** Absent when paid via an installment plan (no single transaction to
   * point at — see installmentPlanId instead). */
  paymentTransactionId?: string;
  installmentPlanId?: string;
}

function computeStatus(dueDate: string, paidAt?: string): AccountBill["status"] {
  if (paidAt) return "paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due.getTime() < today.getTime() ? "overdue" : "upcoming";
}

export const accountService = {
  async list(userId: string): Promise<AccountBill[]> {
    const bills = await store.list(userId);
    return bills.map((bill) => ({
      ...bill,
      status: computeStatus(bill.dueDate, bill.paidAt),
    }));
  },

  get: (userId: string, id: string) => store.get(userId, id),

  async create(userId: string, input: AccountBillInput): Promise<AccountBill> {
    const now = new Date().toISOString();
    const bill: AccountBill = {
      id: generateId(),
      userId,
      ...input,
      status: computeStatus(input.dueDate),
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, bill);
  },

  async update(userId: string, id: string, input: Partial<AccountBillInput>) {
    return store.update(userId, id, { ...input, updatedAt: new Date().toISOString() });
  },

  /** Records a full payment: method, account/card used, amount, and the
   * linked expense transaction. Does NOT itself create the transaction —
   * the caller (FinanceDataContext) owns that so it can also handle
   * installments/invoices consistently. */
  async markPaid(userId: string, id: string, payment: BillPaymentInput) {
    return store.update(userId, id, {
      status: "paid",
      paidAt: payment.paidAt,
      paidAmount: payment.paidAmount,
      paidAccountId: payment.paidAccountId,
      paidCardId: payment.paidCardId,
      paymentMethod: payment.paymentMethod,
      paymentTransactionId: payment.paymentTransactionId,
      installmentPlanId: payment.installmentPlanId,
      updatedAt: new Date().toISOString(),
    });
  },

  async markUnpaid(userId: string, id: string) {
    const bill = await store.get(userId, id);
    if (!bill) return undefined;
    return store.update(userId, id, {
      status: computeStatus(bill.dueDate),
      paidAt: undefined,
      paidAmount: undefined,
      paidAccountId: undefined,
      paidCardId: undefined,
      paymentTransactionId: undefined,
      installmentPlanId: undefined,
      updatedAt: new Date().toISOString(),
    });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
