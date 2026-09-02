/**
 * Local persistence layer. Every collection is namespaced by userId so
 * data never leaks across accounts on a shared device. Each function
 * returns a Promise so this can be swapped for a real API/Firestore
 * backend later without touching the call sites.
 */

function storageKey(userId: string, collection: string) {
  return `emdia:${userId}:${collection}`;
}

function readAll<T>(userId: string, collection: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, collection));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeAll<T>(userId: string, collection: string, items: T[]): void {
  localStorage.setItem(storageKey(userId, collection), JSON.stringify(items));
}

export function createLocalCollection<T extends { id: string }>(collection: string) {
  return {
    async list(userId: string): Promise<T[]> {
      return readAll<T>(userId, collection);
    },

    async get(userId: string, id: string): Promise<T | undefined> {
      return readAll<T>(userId, collection).find((item) => item.id === id);
    },

    async create(userId: string, item: T): Promise<T> {
      const items = readAll<T>(userId, collection);
      items.push(item);
      writeAll(userId, collection, items);
      return item;
    },

    async update(userId: string, id: string, patch: Partial<T>): Promise<T | undefined> {
      const items = readAll<T>(userId, collection);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return undefined;
      items[index] = { ...items[index], ...patch };
      writeAll(userId, collection, items);
      return items[index];
    },

    async remove(userId: string, id: string): Promise<void> {
      const items = readAll<T>(userId, collection).filter((item) => item.id !== id);
      writeAll(userId, collection, items);
    },

    async replaceAll(userId: string, items: T[]): Promise<void> {
      writeAll(userId, collection, items);
    },
  };
}

export function readValue<T>(userId: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(userId, key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeValue<T>(userId: string, key: string, value: T): void {
  localStorage.setItem(storageKey(userId, key), JSON.stringify(value));
}

export function generateId(): string {
  return crypto.randomUUID();
}
