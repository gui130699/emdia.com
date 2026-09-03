import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { BankAccount } from "../types/finance";
import type { FinancialInstitution } from "../types/institution";

const store = createRepository<BankAccount>("accounts");

export interface BankAccountInput {
  name: string;
  kind: BankAccount["kind"];
  initialBalance?: number;
  balanceAsOfDate?: string;
  institution?: FinancialInstitution;
  externalBankAccountId?: string;
  externalBranchId?: string;
}

export const bankAccountService = {
  /** Never seeds fictitious default accounts — an empty list here means the
   * user genuinely has none yet, and the UI must say so explicitly rather
   * than inventing a "Conta corrente" no one asked for. */
  list: (userId: string) => store.list(userId),

  get: (userId: string, id: string) => store.get(userId, id),

  async create(userId: string, input: BankAccountInput): Promise<BankAccount> {
    const now = new Date().toISOString();
    const account: BankAccount = {
      id: generateId(),
      userId,
      name: input.name,
      kind: input.kind,
      initialBalance: input.initialBalance ?? 0,
      institutionCode: input.institution?.code,
      institutionName: input.institution?.name,
      institutionFullName: input.institution?.fullName,
      institutionIspb: input.institution?.ispb,
      institutionLogoUrl: input.institution?.logoUrl,
      externalBankAccountId: input.externalBankAccountId,
      externalBranchId: input.externalBranchId,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, account);
  },

  async update(userId: string, id: string, patch: Partial<Omit<BankAccount, "id" | "userId">>) {
    return store.update(userId, id, { ...patch, updatedAt: new Date().toISOString() });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
