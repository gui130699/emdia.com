import { createLocalCollection, generateId } from "./localStore";
import type { AccountBill } from "../types/finance";

const store = createLocalCollection<AccountBill>("bills");

export interface AccountBillInput {
  description: string;
  amount: number;
  dueDate: string;
  categoryId: string;
  recurring: boolean;
  recurringFrequency?: AccountBill["recurringFrequency"];
  paymentMethod?: AccountBill["paymentMethod"];
  accountId?: string;
  notes?: string;
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

  async markPaid(userId: string, id: string, transactionId?: string) {
    return store.update(userId, id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      transactionId,
      updatedAt: new Date().toISOString(),
    });
  },

  async markUnpaid(userId: string, id: string) {
    const bill = await store.get(userId, id);
    if (!bill) return undefined;
    return store.update(userId, id, {
      status: computeStatus(bill.dueDate),
      paidAt: undefined,
      transactionId: undefined,
      updatedAt: new Date().toISOString(),
    });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
