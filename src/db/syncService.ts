import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db as firestore } from "../firebase";
import { getDb, type SyncOperation, type SyncQueueItem } from "./database";
import { generateId } from "../services/localStore";

const MAX_BACKOFF_MS = 60_000;
const DRAIN_INTERVAL_MS = 20_000;

export type AggregateSyncStatus = "idle" | "pending" | "syncing" | "error";

type Listener = (status: AggregateSyncStatus) => void;
const listeners = new Set<Listener>();
let lastStatus: AggregateSyncStatus = "idle";

function notify(status: AggregateSyncStatus) {
  lastStatus = status;
  for (const l of listeners) l(status);
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastStatus);
  return () => listeners.delete(listener);
}

/** Tables that mirror 1:1 into `users/{uid}/{entity}` Firestore collections.
 * Settings is intentionally excluded — it's a tiny preference blob that
 * doesn't need cross-device sync urgency and has its own doc shape. */
const SYNCED_ENTITIES = [
  "transactions",
  "accounts",
  "cards",
  "bills",
  "categories",
  "goals",
  "installmentPlans",
  "installments",
  "invoices",
] as const;

export async function enqueueSync(
  userId: string,
  entity: string,
  entityId: string,
  operation: SyncOperation,
  payload: unknown
): Promise<void> {
  const db = getDb(userId);
  const item: SyncQueueItem = {
    id: generateId(),
    userId,
    entity,
    entityId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  await db.syncQueue.add(item);
  notify("pending");
  // Fire-and-forget: try to drain immediately if we're online.
  void drainSyncQueue(userId);
}

function backoffMs(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
}

let draining = new Set<string>();

export async function drainSyncQueue(userId: string): Promise<void> {
  if (!navigator.onLine) return;
  if (draining.has(userId)) return;
  draining.add(userId);
  try {
    const db = getDb(userId);
    const items = await db.syncQueue.where("status").anyOf("pending", "error").sortBy("createdAt");
    if (items.length === 0) {
      notify("idle");
      return;
    }

    let hadError = false;
    for (const item of items) {
      if (item.nextAttemptAt && new Date(item.nextAttemptAt) > new Date()) continue;

      await db.syncQueue.update(item.id, { status: "syncing" });
      notify("syncing");
      try {
        const ref = doc(firestore, "users", userId, item.entity, item.entityId);
        if (item.operation === "delete") {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, item.payload as Record<string, unknown>, { merge: false });
        }
        await db.syncQueue.delete(item.id);
      } catch (err) {
        hadError = true;
        const attempts = item.attempts + 1;
        await db.syncQueue.update(item.id, {
          status: "error",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
        });
      }
    }
    notify(hadError ? "error" : "idle");
  } finally {
    draining.delete(userId);
  }
}

/** Pulls remote documents once (e.g. on login / app start) so a change made
 * on another device shows up here. Last-write-wins by `updatedAt`: a remote
 * doc only overwrites the local one if it's strictly newer, and a local doc
 * with no remote counterpart is left untouched (it will push up normally). */
export async function pullRemoteChanges(userId: string): Promise<void> {
  if (!navigator.onLine) return;
  const db = getDb(userId);

  for (const entity of SYNCED_ENTITIES) {
    try {
      const snapshot = await getDocs(collection(firestore, "users", userId, entity));
      if (snapshot.empty) continue;

      const table = db.table(entity);
      const updates: Record<string, unknown>[] = [];
      for (const docSnap of snapshot.docs) {
        const remote = docSnap.data() as Record<string, unknown>;
        const local = await table.get(docSnap.id);
        const remoteUpdatedAt = typeof remote.updatedAt === "string" ? remote.updatedAt : null;
        const localUpdatedAt =
          local && typeof (local as Record<string, unknown>).updatedAt === "string"
            ? ((local as Record<string, unknown>).updatedAt as string)
            : null;
        if (!local || !localUpdatedAt || (remoteUpdatedAt && remoteUpdatedAt > localUpdatedAt)) {
          updates.push(remote);
        }
      }
      if (updates.length > 0) await table.bulkPut(updates);
    } catch {
      // Best-effort: if a given collection can't be read (rules, offline
      // mid-loop, etc.) we just skip it — local data remains authoritative.
    }
  }
}

let engineStarted = new Set<string>();

/** Wires the background drainer to the `online` event and a light polling
 * interval, and does one remote pull. Call once per signed-in session. */
export function startSyncEngine(userId: string): () => void {
  if (engineStarted.has(userId)) return () => {};
  engineStarted.add(userId);

  const onOnline = () => void drainSyncQueue(userId);
  window.addEventListener("online", onOnline);

  void pullRemoteChanges(userId).then(() => drainSyncQueue(userId));

  const interval = setInterval(() => void drainSyncQueue(userId), DRAIN_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
    engineStarted.delete(userId);
  };
}
