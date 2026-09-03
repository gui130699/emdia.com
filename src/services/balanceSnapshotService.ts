import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { BalanceSnapshot, BalanceSnapshotSource } from "../types/finance";

const store = createRepository<BalanceSnapshot>("balanceSnapshots");

export interface CreateSnapshotInput {
  accountId: string;
  balance: number;
  availableBalance?: number;
  asOfDate: string;
  asOfDateTime?: string;
  source: BalanceSnapshotSource;
  importBatchId?: string;
  institutionCode?: string;
  externalBankAccountId?: string;
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

  /** Idempotent by the financial position itself, not by importBatchId.
   * Reimporting the same statement produces a new batch id, but must not
   * create a second balance position. A corrected source file for the same
   * instant updates the existing position and its updatedAt timestamp. */
  async create(userId: string, input: CreateSnapshotInput): Promise<BalanceSnapshot> {
    const existing = await this.listForAccount(userId, input.accountId);
    const duplicate = existing.find(
      (s) =>
        s.asOfDate === input.asOfDate &&
        (s.asOfDateTime ?? "") === (input.asOfDateTime ?? "") &&
        s.source === input.source &&
        (s.externalBankAccountId ?? "") === (input.externalBankAccountId ?? "")
    );
    if (duplicate) {
      return store.update(userId, duplicate.id, {
        balance: input.balance,
        availableBalance: input.availableBalance,
        importBatchId: duplicate.importBatchId ?? input.importBatchId,
        institutionCode: input.institutionCode ?? duplicate.institutionCode,
        externalBankAccountId: input.externalBankAccountId ?? duplicate.externalBankAccountId,
        reviewStatus: "confirmed",
        updatedAt: new Date().toISOString(),
      }) as Promise<BalanceSnapshot>;
    }
    const now = new Date().toISOString();
    const snapshot: BalanceSnapshot = {
      id: generateId(),
      userId,
      accountId: input.accountId,
      balance: input.balance,
      availableBalance: input.availableBalance,
      asOfDate: input.asOfDate,
      asOfDateTime: input.asOfDateTime,
      source: input.source,
      importBatchId: input.importBatchId,
      institutionCode: input.institutionCode,
      externalBankAccountId: input.externalBankAccountId,
      reviewStatus: "confirmed",
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, snapshot);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
