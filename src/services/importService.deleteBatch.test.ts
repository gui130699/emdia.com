import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db/database";
import { createRepository } from "../db/dexieRepository";
import type { ImportBatch } from "../types/finance";

vi.mock("../db/syncService", () => ({ enqueueSync: vi.fn(async () => undefined) }));

let counter = 0;
function freshUserId(): string {
  counter += 1;
  return `import-batch-delete-test-${counter}`;
}

function batch(patch: Partial<ImportBatch>): ImportBatch {
  const now = new Date().toISOString();
  return {
    id: patch.id ?? "batch-1",
    userId: patch.userId ?? "u",
    fileName: "extrato.ofx",
    fileType: "ofx",
    totalRecords: 1,
    newRecords: 1,
    duplicateRecords: 0,
    ignoredRecords: 0,
    reviewRecords: 0,
    importedRecords: 1,
    status: "undone",
    createdAt: now,
    ...patch,
  };
}

describe("importService batch record deletion", () => {
  const usedUserIds: string[] = [];

  afterEach(async () => {
    for (const id of usedUserIds.splice(0)) {
      await getDb(id).delete();
    }
  });

  it("deletes an undone batch record", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const store = createRepository<ImportBatch>("importBatches");
    await store.create(userId, batch({ userId, status: "undone" }));

    const { importService } = await import("./importService");
    const result = await importService.deleteBatchRecord(userId, "batch-1");
    expect(result.ok).toBe(true);
    expect(await importService.getBatch(userId, "batch-1")).toBeUndefined();
  });

  it("refuses to delete a completed batch directly", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const store = createRepository<ImportBatch>("importBatches");
    await store.create(userId, batch({ userId, status: "completed" }));

    const { importService } = await import("./importService");
    const result = await importService.deleteBatchRecord(userId, "batch-1");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/desfaça/i);
    expect(await importService.getBatch(userId, "batch-1")).toBeDefined();
  });

  it("returns a not-found result for a missing batch", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const { importService } = await import("./importService");
    const result = await importService.deleteBatchRecord(userId, "does-not-exist");
    expect(result.ok).toBe(false);
  });

  it("bulk-clears only undone batches, leaving completed ones untouched", async () => {
    const userId = freshUserId();
    usedUserIds.push(userId);
    const store = createRepository<ImportBatch>("importBatches");
    await store.create(userId, batch({ id: "undone-1", userId, status: "undone" }));
    await store.create(userId, batch({ id: "undone-2", userId, status: "undone" }));
    await store.create(userId, batch({ id: "completed-1", userId, status: "completed" }));

    const { importService } = await import("./importService");
    const removed = await importService.clearUndoneBatches(userId);
    expect(removed).toBe(2);

    const remaining = await importService.listBatches(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("completed-1");
  });
});
