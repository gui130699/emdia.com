import { getDb } from "./database";
import { enqueueSync } from "./syncService";

/**
 * Generic Dexie-backed CRUD repository with the exact same shape as the old
 * localStorage-based `createLocalCollection`, so existing services keep
 * their public API. Every mutation writes to IndexedDB first (source of
 * truth for the UI) and then enqueues a background Firestore sync — the
 * caller never waits on the network.
 */
export function createRepository<T extends { id: string }>(entity: string) {
  return {
    async list(userId: string): Promise<T[]> {
      return getDb(userId).table<T, string>(entity).toArray();
    },

    async get(userId: string, id: string): Promise<T | undefined> {
      return getDb(userId).table<T, string>(entity).get(id);
    },

    async create(userId: string, item: T): Promise<T> {
      await getDb(userId).table<T, string>(entity).put(item);
      void enqueueSync(userId, entity, item.id, "create", item);
      return item;
    },

    async update(userId: string, id: string, patch: Partial<T>): Promise<T | undefined> {
      const table = getDb(userId).table<T, string>(entity);
      const existing = await table.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch } as T;
      await table.put(updated);
      void enqueueSync(userId, entity, id, "update", updated);
      return updated;
    },

    async remove(userId: string, id: string): Promise<void> {
      await getDb(userId).table<T, string>(entity).delete(id);
      void enqueueSync(userId, entity, id, "delete", null);
    },

    async replaceAll(userId: string, items: T[]): Promise<void> {
      const table = getDb(userId).table<T, string>(entity);
      await table.bulkPut(items);
      for (const item of items) {
        void enqueueSync(userId, entity, (item as unknown as { id: string }).id, "create", item);
      }
    },
  };
}
