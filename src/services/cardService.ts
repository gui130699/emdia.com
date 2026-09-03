import { createLocalCollection, generateId, readValue, writeValue } from "./localStore";
import type { CreditCard } from "../types/finance";

const store = createLocalCollection<CreditCard>("cards");

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
}

/** period key like "2026-09" identifying which invoice cycle was settled */
function invoicePaymentsKey() {
  return "cardInvoicePayments";
}

export const cardService = {
  list: (userId: string) => store.list(userId),

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

  getPaidInvoices(userId: string): Record<string, boolean> {
    return readValue(userId, invoicePaymentsKey(), {} as Record<string, boolean>);
  },

  markInvoicePaid(userId: string, cardId: string, periodKey: string) {
    const paid = readValue(userId, invoicePaymentsKey(), {} as Record<string, boolean>);
    paid[`${cardId}:${periodKey}`] = true;
    writeValue(userId, invoicePaymentsKey(), paid);
  },
};
