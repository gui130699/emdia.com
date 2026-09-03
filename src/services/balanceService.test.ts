import { describe, expect, it } from "vitest";
import { computeAccountBalance, computeTotalBalance } from "./balanceService";
import type { BalanceSnapshot, BankAccount, Transaction } from "../types/finance";

const account = (initialBalance?: number): BankAccount => ({
  id: "account-1", userId: "u", name: "Conta", kind: "corrente", initialBalance,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

const transaction = (patch: Partial<Transaction>): Transaction => ({
  id: "t", userId: "u", type: "expense", description: "Movimento", amount: 10,
  date: "2026-01-10", categoryId: "", accountId: "account-1", paymentMethod: "pix",
  recurring: false, createdAt: "2026-01-10T00:00:00.000Z", updatedAt: "2026-01-10T00:00:00.000Z",
  source: "manual",
  ...patch,
} as Transaction);

describe("balanceService", () => {
  it("keeps an uninformed balance unknown instead of turning it into zero", () => {
    expect(computeAccountBalance(account(), [])).toBeUndefined();
    expect(computeTotalBalance([account()], [], [])).toBeUndefined();
  });

  it("preserves an explicitly informed zero", () => {
    expect(computeAccountBalance(account(0), [])).toBe(0);
  });

  it("uses the snapshot timestamp and applies only later movements", () => {
    const snapshot: BalanceSnapshot = {
      id: "s", userId: "u", accountId: "account-1", balance: 392.01,
      asOfDate: "2026-01-10", asOfDateTime: "2026-01-10T12:00:00+00:00", source: "ofx",
      createdAt: "2026-01-10T12:00:00.000Z", updatedAt: "2026-01-10T12:00:00.000Z",
    };
    const before = transaction({ id: "before", postingDateTime: "2026-01-10T10:00:00+00:00" });
    const after = transaction({ id: "after", amount: 20, postingDateTime: "2026-01-10T13:00:00+00:00" });
    expect(computeAccountBalance(account(), [before, after], [snapshot])).toBe(372.01);
  });

  it("subtracts an invoice payment from the chosen bank account and ignores reversals", () => {
    const paid = transaction({ type: "payment", amount: 100, relatedCardId: "card" });
    expect(computeAccountBalance(account(500), [paid])).toBe(400);
    expect(computeAccountBalance(account(500), [{ ...paid, isReversed: true }])).toBe(500);
  });
});
