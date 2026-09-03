import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { Category } from "../types/finance";
import { DEFAULT_CATEGORIES } from "../constants/categories";

const store = createRepository<Category>("categories");

export interface CategoryInput {
  name: string;
  type: Category["type"];
  icon: string;
  color: string;
}

export const categoryService = {
  async list(userId: string): Promise<Category[]> {
    const existing = await store.list(userId);
    if (existing.length > 0) return existing;

    const seeded = DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      id: generateId(),
      userId,
      isDefault: true,
    }));
    await store.replaceAll(userId, seeded);
    return seeded;
  },

  async create(userId: string, input: CategoryInput): Promise<Category> {
    const category: Category = { id: generateId(), userId, ...input };
    return store.create(userId, category);
  },

  async update(userId: string, id: string, input: Partial<CategoryInput>) {
    return store.update(userId, id, input);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
