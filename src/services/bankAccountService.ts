import { createLocalCollection, generateId } from "./localStore";
import type { BankAccount } from "../types/finance";
import type { FinancialInstitution } from "../types/institution";

const store = createLocalCollection<BankAccount>("bankAccounts");

const DEFAULT_ACCOUNTS: Array<Pick<BankAccount, "name" | "kind">> = [
  { name: "Conta corrente", kind: "corrente" },
  { name: "Conta digital", kind: "digital" },
];

export const bankAccountService = {
  async list(userId: string): Promise<BankAccount[]> {
    const existing = await store.list(userId);
    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    const seeded = DEFAULT_ACCOUNTS.map((acc) => ({
      ...acc,
      id: generateId(),
      userId,
      createdAt: now,
    }));
    await store.replaceAll(userId, seeded);
    return seeded;
  },

  async create(
    userId: string,
    name: string,
    kind: BankAccount["kind"],
    institution?: FinancialInstitution
  ): Promise<BankAccount> {
    const account: BankAccount = {
      id: generateId(),
      userId,
      name,
      kind,
      institutionCode: institution?.code,
      institutionName: institution?.name,
      institutionFullName: institution?.fullName,
      institutionIspb: institution?.ispb,
      institutionLogoUrl: institution?.logoUrl,
      createdAt: new Date().toISOString(),
    };
    return store.create(userId, account);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
