import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db/database";

vi.mock("../db/syncService", () => ({ enqueueSync: vi.fn(async () => undefined) }));

describe("installmentService", () => {
  const userId = "installment-test";

  afterEach(async () => {
    await getDb(userId).delete();
  });

  it("tracks 4/12 as three historical positions and nine remaining without fake past transactions", async () => {
    const { installmentService } = await import("./installmentService");
    const plan = await installmentService.create(userId, {
      sourceType: "import", cardId: "card", description: "Compra", categoryId: "cat",
      totalAmount: 588.84, installmentCount: 12, firstInstallmentDate: "2026-08-10",
      startNumber: 4, installmentAmount: 49.07, priorInstallmentsTreatment: "historical",
      source: "import", importBatchId: "batch",
      observedTransaction: { description: "Compra 4/12", externalRecordId: "fitid", importSource: "ofx" },
    });
    const installments = await installmentService.installmentsForPlan(userId, plan.id);
    const transactions = await getDb(userId).transactions.toArray();
    expect(plan.currentObservedNumber).toBe(4);
    expect(installments.filter((item) => item.status === "historical")).toHaveLength(3);
    expect(installments.filter((item) => item.status !== "historical" && item.status !== "paid")).toHaveLength(9);
    expect(installments.filter((item) => item.status !== "historical").reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(441.63, 2);
    expect(transactions).toHaveLength(9);
    expect(transactions.filter((item) => item.source === "import")).toHaveLength(1);
  });
});
