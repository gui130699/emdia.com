import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import type { ImportProfile } from "../types/finance";

const store = createRepository<ImportProfile>("importProfiles");

export const importProfileService = {
  list: (userId: string) => store.list(userId),

  async findBySignals(
    userId: string,
    sourceFormat: ImportProfile["sourceFormat"],
    signals: string[]
  ): Promise<ImportProfile | undefined> {
    const normalizedSignals = new Set(signals.map((signal) => signal.trim().toLowerCase()).filter(Boolean));
    return (await store.list(userId)).find(
      (profile) =>
        profile.sourceFormat === sourceFormat &&
        profile.signatures.some((signature) => normalizedSignals.has(signature.toLowerCase()))
    );
  },

  async save(
    userId: string,
    input: Omit<ImportProfile, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<ImportProfile> {
    const profiles = await store.list(userId);
    const existing = profiles.find(
      (profile) =>
        profile.sourceFormat === input.sourceFormat &&
        profile.institutionCode === input.institutionCode &&
        profile.product === input.product
    );
    const now = new Date().toISOString();
    if (existing) {
      return (await store.update(userId, existing.id, {
        ...input,
        signatures: Array.from(new Set([...existing.signatures, ...input.signatures])),
        updatedAt: now,
      })) as ImportProfile;
    }
    return store.create(userId, {
      id: generateId(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  },
};
