import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { normalizeDescription } from "../utils/normalizeDescription";
import type { ReconciliationAlias, ReconciliationAliasTargetType } from "../types/finance";

const store = createRepository<ReconciliationAlias>("reconciliationAliases");

export const reconciliationAliasService = {
  list: (userId: string) => store.list(userId),

  async findForDescription(
    userId: string,
    rawDescription: string,
    accountId?: string,
    institutionCode?: string
  ): Promise<ReconciliationAlias | undefined> {
    const normalized = normalizeDescription(rawDescription);
    const all = await store.list(userId);
    return all
      .filter(
        (alias) =>
          (!accountId || !alias.accountId || alias.accountId === accountId) &&
          (!institutionCode || !alias.institutionCode || alias.institutionCode === institutionCode) &&
          (normalized.includes(alias.normalizedBankDescription) || alias.normalizedBankDescription.includes(normalized))
      )
      .sort((left, right) => {
        const leftScope = Number(left.accountId === accountId) + Number(left.institutionCode === institutionCode);
        const rightScope = Number(right.accountId === accountId) + Number(right.institutionCode === institutionCode);
        return rightScope - leftScope || right.matchCount - left.matchCount;
      })[0];
  },

  /** Learns (or reinforces) that a bank description points at a given
   * target — called whenever the user confirms a bill/recurring-rule
   * match, so the next import with the same description is trusted more. */
  async learn(
    userId: string,
    rawDescription: string,
    targetType: ReconciliationAliasTargetType,
    targetId?: string,
    recurringRuleId?: string,
    institutionCode?: string,
    accountId?: string
  ): Promise<void> {
    const normalized = normalizeDescription(rawDescription);
    const existing = (await store.list(userId)).find(
      (alias) =>
        alias.normalizedBankDescription === normalized &&
        (alias.accountId ?? "") === (accountId ?? "") &&
        (alias.institutionCode ?? "") === (institutionCode ?? "")
    );
    const now = new Date().toISOString();
    if (existing) {
      await store.update(userId, existing.id, {
        targetType,
        targetId,
        recurringRuleId,
        institutionCode,
        accountId,
        matchCount: existing.matchCount + 1,
        lastMatchedAt: now,
        updatedAt: now,
      });
      return;
    }
    const alias: ReconciliationAlias = {
      id: generateId(),
      userId,
      targetType,
      targetId,
      recurringRuleId,
      institutionCode,
      accountId,
      rawBankDescription: rawDescription,
      normalizedBankDescription: normalized,
      matchCount: 1,
      lastMatchedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await store.create(userId, alias);
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
