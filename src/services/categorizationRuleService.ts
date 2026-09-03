import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { normalizeDescription } from "../utils/normalizeDescription";
import type { CategorizationRule, TransactionType } from "../types/finance";

const store = createRepository<CategorizationRule>("categorizationRules");

/** A handful of well-known merchants to seed new users with, matching the
 * examples in the product brief. Not exhaustive — just enough that a first
 * import isn't 100% "Selecionar categoria". */
const SEED_PATTERNS: Array<{ pattern: string; categoryName: string }> = [
  { pattern: "uber", categoryName: "Transporte" },
  { pattern: "ifood", categoryName: "Alimentação" },
  { pattern: "netflix", categoryName: "Lazer" },
  { pattern: "spotify", categoryName: "Lazer" },
  { pattern: "posto", categoryName: "Transporte" },
  { pattern: "farmacia", categoryName: "Saúde" },
  { pattern: "drogaria", categoryName: "Saúde" },
  { pattern: "supermercado", categoryName: "Alimentação" },
  { pattern: "mercado", categoryName: "Alimentação" },
  { pattern: "99app", categoryName: "Transporte" },
  { pattern: "amazon", categoryName: "Outros" },
];

export const categorizationRuleService = {
  list: (userId: string) => store.list(userId),

  async seedIfEmpty(userId: string, categories: { id: string; name: string }[]): Promise<void> {
    const existing = await store.list(userId);
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    for (const [index, seed] of SEED_PATTERNS.entries()) {
      const category = categories.find((c) => c.name.toLowerCase() === seed.categoryName.toLowerCase());
      if (!category) continue;
      const rule: CategorizationRule = {
        id: generateId(),
        userId,
        pattern: seed.pattern,
        normalizedPattern: normalizeDescription(seed.pattern),
        categoryId: category.id,
        priority: index,
        createdAt: now,
        updatedAt: now,
      };
      await store.create(userId, rule);
    }
  },

  /** Finds the best matching category for a description, or undefined. */
  async matchCategory(
    userId: string,
    description: string,
    type?: TransactionType
  ): Promise<string | undefined> {
    const normalized = normalizeDescription(description);
    const rules = await store.list(userId);
    const candidates = rules
      .filter((r) => !r.transactionType || r.transactionType === type)
      .sort((a, b) => a.priority - b.priority);
    const match = candidates.find((r) => normalized.includes(r.normalizedPattern));
    return match?.categoryId;
  },

  async learn(
    userId: string,
    pattern: string,
    categoryId: string,
    transactionType?: TransactionType
  ): Promise<void> {
    const now = new Date().toISOString();
    const normalizedPattern = normalizeDescription(pattern);
    const existing = await store.list(userId);
    const already = existing.find((r) => r.normalizedPattern === normalizedPattern);
    if (already) {
      await store.update(userId, already.id, { categoryId, updatedAt: now });
      return;
    }
    const rule: CategorizationRule = {
      id: generateId(),
      userId,
      pattern,
      normalizedPattern,
      categoryId,
      transactionType,
      priority: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    await store.create(userId, rule);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
