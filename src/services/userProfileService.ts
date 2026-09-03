import { doc, getDoc } from "firebase/firestore";
import { db as firestore } from "../firebase";
import { createRepository } from "../db/dexieRepository";
import type { UserProfile } from "../types/finance";

const store = createRepository<UserProfile>("userProfile");

/** One-time read of the legacy profile location (a single `users/{uid}`
 * document, from before the profile had its own offline-synced entity) so
 * existing users don't lose their name/phone/photo on first load here. */
async function migrateLegacyProfile(uid: string): Promise<UserProfile | undefined> {
  try {
    const snapshot = await getDoc(doc(firestore, "users", uid));
    if (!snapshot.exists()) return undefined;
    const legacy = snapshot.data() as { fullName?: string; email?: string; phone?: string; photoURL?: string };
    if (!legacy.fullName && !legacy.phone) return undefined;
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: "current",
      fullName: legacy.fullName ?? "",
      email: legacy.email ?? "",
      phone: legacy.phone,
      photoURL: legacy.photoURL,
      createdAt: now,
      updatedAt: now,
    };
    return profile;
  } catch {
    return undefined;
  }
}

// Concurrent callers (e.g. ProfileCard's mount effect and an immediate
// save) must share one migration attempt, not race independent ones —
// otherwise a slow migration read that resolves *after* a save has already
// written the real data would blindly overwrite it with the phone-less
// legacy copy. Cached per user for the life of the page.
const migrationInFlight = new Map<string, Promise<UserProfile | undefined>>();

async function ensureProfile(userId: string): Promise<UserProfile | undefined> {
  const local = await store.get(userId, "current");
  if (local) return local;

  let inFlight = migrationInFlight.get(userId);
  if (!inFlight) {
    inFlight = migrateLegacyProfile(userId).then(async (migrated) => {
      // Re-check right before writing: another caller may have created or
      // updated the row while this Firestore read was in flight.
      const stillLocal = await store.get(userId, "current");
      if (stillLocal) return stillLocal;
      if (migrated) return store.create(userId, migrated);
      return undefined;
    });
    migrationInFlight.set(userId, inFlight);
  }
  return inFlight;
}

export const userProfileService = {
  // Only the read side does the (network-dependent) legacy migration check
  // — it's just prefilling a form, fine to take a moment. Saving must never
  // wait on that: it's purely local so it works instantly offline too.
  get: (userId: string) => ensureProfile(userId),

  async update(userId: string, patch: Partial<Omit<UserProfile, "id" | "createdAt" | "updatedAt">>): Promise<UserProfile> {
    const local = await store.get(userId, "current");
    const now = new Date().toISOString();
    if (local) {
      return (await store.update(userId, "current", { ...patch, updatedAt: now })) as UserProfile;
    }
    return store.create(userId, {
      id: "current",
      fullName: "",
      email: "",
      ...patch,
      createdAt: now,
      updatedAt: now,
    });
  },
};
