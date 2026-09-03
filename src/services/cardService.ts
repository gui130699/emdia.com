import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { CreditCard } from "../types/finance";

const store = createRepository<CreditCard>("cards");

export interface CreditCardInput {
  name: string;
  institution: string;
  institutionCode?: string;
  institutionIspb?: string;
  institutionLogoUrl?: string;
  type: CreditCard["type"];
  lastFourDigits: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  accountId?: string;
  color: string;
  useCustomColor?: boolean;
}

export const cardService = {
  list: (userId: string) => store.list(userId),
  get: (userId: string, id: string) => store.get(userId, id),

  async create(userId: string, input: CreditCardInput): Promise<CreditCard> {
    const now = new Date().toISOString();
    const card: CreditCard = {
      id: generateId(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, card);
  },

  async update(userId: string, id: string, input: Partial<CreditCardInput>) {
    return store.update(userId, id, { ...input, updatedAt: new Date().toISOString() });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
