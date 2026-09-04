import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db/database";
import type { InvoicePeriod } from "../utils/cardInvoice";

vi.mock("../db/syncService", () => ({ enqueueSync: vi.fn(async () => undefined) }));

const cardId = "card-1";

// Far enough in the future that the invoice's computed status is always
// "open", regardless of when this suite actually runs.
function openPeriod(periodKey: string): InvoicePeriod {
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 5);
  return {
    cycleStart: farFuture,
    cycleEnd: farFuture,
    dueDate: farFuture,
    periodKey,
  };
}

// Each test uses its own userId (a fresh Dexie database) — the getDb()
// cache never evicts a deleted instance, so reusing one userId across
// afterEach-cleaned tests leaves later tests hitting a closed database.
let counter = 0;
function freshUserId(): string {
  counter += 1;
  return `invoice-delete-test-${counter}`;
}

describe("invoiceService.deleteRecord", () => {
  const usedUserIds: string[] = [];

  afterEach(async () => {
    for (const id of usedUserIds.splice(0)) {
      await getDb(id).delete();
    }
  });

  it("deletes an open invoice with no payments", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { invoiceService } = await import("./invoiceService");
    const invoice = await invoiceService.recordStatementSnapshot(
      userId,
      cardId,
      openPeriod("2099-01"),
      { statementBalance: 100 },
      100
    );
    expect(invoice.status).not.toBe("paid");
    expect(invoice.status).not.toBe("partial");

    const result = await invoiceService.deleteRecord(userId, invoice.id);
    expect(result.ok).toBe(true);
    expect(await invoiceService.get(userId, invoice.id)).toBeUndefined();
  });

  it("refuses to delete a paid invoice", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { invoiceService } = await import("./invoiceService");
    const invoice = await invoiceService.recordPayment(
      userId,
      cardId,
      openPeriod("2099-02"),
      200,
      200,
      "account-1",
      "tx-1"
    );
    expect(invoice.status).toBe("paid");

    const result = await invoiceService.deleteRecord(userId, invoice.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/paga/i);
    expect(await invoiceService.get(userId, invoice.id)).toBeDefined();
  });

  it("refuses to delete a partially-paid invoice", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { invoiceService } = await import("./invoiceService");
    const invoice = await invoiceService.recordPayment(
      userId,
      cardId,
      openPeriod("2099-03"),
      300,
      100,
      "account-1",
      "tx-2"
    );
    expect(invoice.status).toBe("partial");

    const result = await invoiceService.deleteRecord(userId, invoice.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/parcial/i);
    expect(await invoiceService.get(userId, invoice.id)).toBeDefined();
  });

  it("never deletes the underlying transactions — only the Invoice record", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { invoiceService } = await import("./invoiceService");
    const { transactionService } = await import("./transactionService");
    const tx = await transactionService.create(userId, {
      type: "expense",
      description: "Compra no cartão",
      amount: 50,
      date: "2026-04-05",
      categoryId: "",
      accountId: "",
      cardId,
      paymentMethod: "credito",
      recurring: false,
      source: "import",
      importBatchId: "batch-1",
    });
    const invoice = await invoiceService.recordStatementSnapshot(
      userId,
      cardId,
      openPeriod("2099-04"),
      { statementBalance: 50, importBatchId: "batch-1" },
      50
    );

    const result = await invoiceService.deleteRecord(userId, invoice.id);
    expect(result.ok).toBe(true);
    expect(result.importBatchId).toBe("batch-1");
    expect(await transactionService.get(userId, tx.id)).toBeDefined();
  });

  it("returns a not-found result for a missing invoice", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { invoiceService } = await import("./invoiceService");
    const result = await invoiceService.deleteRecord(userId, "does-not-exist");
    expect(result.ok).toBe(false);
  });
});
