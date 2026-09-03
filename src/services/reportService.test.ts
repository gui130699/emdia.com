import { describe, expect, it } from "vitest";
import { invoicePaymentsTotal, sumByType } from "./reportService";
import type { Transaction } from "../types/finance";

const base: Transaction = {
  id: "base", userId: "u", type: "expense", description: "Compra", amount: 100,
  date: "2026-08-01", categoryId: "cat", accountId: "", paymentMethod: "credito", cardId: "card",
  recurring: false, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
  source: "manual",
};

describe("reports", () => {
  it("counts the bank-side invoice payment once and not every card purchase", () => {
    const payment: Transaction = {
      ...base, id: "payment", type: "payment", cardId: undefined, relatedCardId: "card",
      accountId: "bank-account", originType: "credit_card_invoice", amount: 100,
    };
    expect(sumByType([base, payment])).toEqual({ income: 0, expense: 100, balance: -100 });
    expect(invoicePaymentsTotal([base, payment])).toBe(100);
  });
});
