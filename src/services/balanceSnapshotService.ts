import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { BalanceSnapshot, BalanceSnapshotSource } from "../types/finance";

const store = createRepository<BalanceSnapshot>("balanceSnapshots");

export interface CreateSnapshotInput {
  accountId: string;
  balance: number;
  asOfDate: string;
  source: BalanceSnapshotSource;
  importBatchId?: string;
}

export const balanceSnapshotService = {
  list: (userId: string) => store.list(userId),

  async listForAccount(userId: string, accountId: string): Promise<BalanceSnapshot[]> {
    const all = await store.list(userId);
    return all.filter((s) => s.accountId === accountId).sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  },

  /** The snapshot balances are computed from — the most recent one on or
   * before today for this account, or undefined if there isn't one yet. */
  async latestForAccount(userId: string, accountId: string): Promise<BalanceSnapshot | undefined> {
    const forAccount = await this.listForAccount(userId, accountId);
    return forAccount[forAccount.length - 1];
  },

  /** Idempotent per (accountId, asOfDate, source, importBatchId) — importing
   * the same statement twice must never create a duplicate snapshot. */
  async create(userId: string, input: CreateSnapshotInput): Promise<BalanceSnapshot> {
    const existing = await this.listForAccount(userId, input.accountId);
    const duplicate = existing.find(
      (s) => s.asOfDate === input.asOfDate && s.source === input.source && s.importBatchId === input.importBatchId
    );
    if (duplicate) {
      return store.update(userId, duplicate.id, { balance: input.balance, updatedAt: new Date().toISOString() }) as Promise<BalanceSnapshot>;
    }
    const now = new Date().toISOString();
    const snapshot: BalanceSnapshot = {
      id: generateId(),
      userId,
      accountId: input.accountId,
      balance: input.balance,
      asOfDate: input.asOfDate,
      source: input.source,
      importBatchId: input.importBatchId,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, snapshot);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
