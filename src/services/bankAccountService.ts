import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { BankAccount } from "../types/finance";
import type { FinancialInstitution } from "../types/institution";

const store = createRepository<BankAccount>("accounts");

const DEFAULT_ACCOUNTS: Array<Pick<BankAccount, "name" | "kind">> = [
  { name: "Conta corrente", kind: "corrente" },
  { name: "Conta digital", kind: "digital" },
];

export interface BankAccountInput {
  name: string;
  kind: BankAccount["kind"];
  initialBalance?: number;
  institution?: FinancialInstitution;
}

export const bankAccountService = {
  async list(userId: string): Promise<BankAccount[]> {
    const existing = await store.list(userId);
    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    const seeded = DEFAULT_ACCOUNTS.map((acc) => ({
      ...acc,
      id: generateId(),
      userId,
      initialBalance: 0,
      createdAt: now,
      updatedAt: now,
    }));
    await store.replaceAll(userId, seeded);
    return seeded;
  },

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
