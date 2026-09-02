import { createLocalCollection, generateId } from "./localStore";
import type { Transaction } from "../types/finance";

const store = createLocalCollection<Transaction>("transactions");

export interface TransactionInput {
  type: Transaction["type"];
  description: string;
  amount: number;
  date: string;
  categoryId: string;
  accountId: string;
  cardId?: string;
  paymentMethod: Transaction["paymentMethod"];
  recurring: boolean;
  recurringFrequency?: Transaction["recurringFrequency"];
  notes?: string;
}

export const transactionService = {
  list: (userId: string) => store.list(userId),

  async create(userId: string, input: TransactionInput): Promise<Transaction> {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: generateId(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, transaction);
  },

  async update(userId: string, id: string, input: Partial<TransactionInput>) {
    return store.update(userId, id, { ...input, updatedAt: new Date().toISOString() });
  },

  async duplicate(userId: string, id: string): Promise<Transaction | undefined> {
    const original = await store.get(userId, id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: Transaction = {
      ...original,
      id: generateId(),
      description: `${original.description} (cópia)`,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, copy);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
