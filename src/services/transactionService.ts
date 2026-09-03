import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { Transaction } from "../types/finance";

const store = createRepository<Transaction>("transactions");

export type TransactionInput = Omit<
  Transaction,
  "id" | "userId" | "createdAt" | "updatedAt" | "source"
> & {
  source?: Transaction["source"];
};

export const transactionService = {
  list: (userId: string) => store.list(userId),
  get: (userId: string, id: string) => store.get(userId, id),

  async create(userId: string, input: TransactionInput): Promise<Transaction> {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: generateId(),
      userId,
      source: "manual",
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
      source: "manual",
      originType: undefined,
      originId: undefined,
      importBatchId: undefined,
      externalId: undefined,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, copy);
  },

  /** Marks a transaction as reversed instead of deleting it, used when a
   * payment is undone but we'd rather keep an audit trail. Callers that
   * truly want it gone (e.g. undoing an import) should use remove(). */
  async reverse(userId: string, id: string) {
    return store.update(userId, id, { isReversed: true, reversedAt: new Date().toISOString() });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
