import { getDb } from "./database";
import { generateId } from "../services/localStore";
import { getCurrentInvoicePeriod } from "../utils/cardInvoice";
import type {
  AccountBill,
  BankAccount,
  Category,
  CreditCard,
  FinancialGoal,
  Invoice,
  Transaction,
  UserSettings,
} from "../types/finance";

function migratedFlagKey(userId: string) {
  return `emdia:${userId}:migratedToIndexedDB`;
}

function readLegacyArray<T>(userId: string, collection: string): T[] {
  try {
    const raw = localStorage.getItem(`emdia:${userId}:${collection}`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function readLegacyValue<T>(userId: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(`emdia:${userId}:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * One-time, idempotent migration of a user's localStorage data into their
 * IndexedDB database. Safe to call on every app load: it no-ops once the
 * "migrated" flag is set, and re-running it (e.g. if interrupted) only
 * overwrites rows with the same IDs — it never duplicates or deletes.
 */
export async function migrateFromLocalStorage(userId: string): Promise<void> {
  if (localStorage.getItem(migratedFlagKey(userId)) === "1") return;

  const db = getDb(userId);
  const now = new Date().toISOString();

  try {
    // --- Accounts: backfill fields added by the new model -------------
    const legacyAccounts = readLegacyArray<Record<string, unknown>>(userId, "bankAccounts");
    if (legacyAccounts.length > 0) {
      const accounts: BankAccount[] = legacyAccounts.map((a) => ({
        id: String(a.id),
        userId,
        name: String(a.name ?? "Conta"),
        kind: (a.kind as BankAccount["kind"]) ?? "outro",
        institutionCode: a.institutionCode as string | undefined,
        institutionName: a.institutionName as string | undefined,
        institutionFullName: a.institutionFullName as string | undefined,
        institutionIspb: a.institutionIspb as string | undefined,
        institutionLogoUrl: a.institutionLogoUrl as string | undefined,
        initialBalance: typeof a.initialBalance === "number" ? a.initialBalance : undefined,
        createdAt: String(a.createdAt ?? now),
        updatedAt: String(a.updatedAt ?? a.createdAt ?? now),
      }));
      await db.accounts.bulkPut(accounts);
    }

    // --- Categories: shape unchanged ------------------------------------
    const categories = readLegacyArray<Category>(userId, "categories");
    if (categories.length > 0) await db.categories.bulkPut(categories);

    // --- Cards: shape unchanged (new institution fields optional) -------
    const cards = readLegacyArray<CreditCard>(userId, "cards");
    if (cards.length > 0) await db.cards.bulkPut(cards);

    // --- Goals: shape unchanged ------------------------------------------
    const goals = readLegacyArray<FinancialGoal>(userId, "goals");
    if (goals.length > 0) await db.goals.bulkPut(goals);

    // --- Transactions: backfill required `source` field ------------------
    const legacyTransactions = readLegacyArray<Record<string, unknown>>(userId, "transactions");
    if (legacyTransactions.length > 0) {
      const transactions: Transaction[] = legacyTransactions.map((t) => ({
        ...(t as unknown as Transaction),
        source: (t.source as Transaction["source"]) ?? "manual",
      }));
      await db.transactions.bulkPut(transactions);
    }

    // --- Bills: shape unchanged, new payment fields stay undefined ------
    const bills = readLegacyArray<AccountBill>(userId, "bills");
    if (bills.length > 0) await db.bills.bulkPut(bills);

    // --- Settings: single row -------------------------------------------
    const settings = readLegacyValue<UserSettings>(userId, "settings");
    if (settings) await db.settings.put({ key: "current", value: settings });

    // --- Reconstruct paid-invoice history from the old boolean map ------
    // Previously "fatura paga" was tracked as {cardId:periodKey: true} with
    // no amount/date. We rebuild a best-effort Invoice record from the
    // transactions that existed in that cycle so history isn't silently lost.
    const legacyPaidInvoices = readLegacyValue<Record<string, boolean>>(userId, "cardInvoicePayments");
    if (legacyPaidInvoices && cards.length > 0) {
      const invoices: Invoice[] = [];
      for (const [key, paid] of Object.entries(legacyPaidInvoices)) {
        if (!paid) continue;
        const [cardId, periodKey] = key.split(":");
        const card = cards.find((c) => c.id === cardId);
        if (!card) continue;
        const [year, month] = periodKey.split("-").map(Number);
        const reference = new Date(year, (month ?? 1) - 1, 15);
        const period = getCurrentInvoicePeriod(card, reference);
        if (!period) continue;
        const total = legacyTransactions
          .filter((t) => {
            if (t.cardId !== cardId) return false;
            const d = new Date(String(t.date) + "T00:00:00");
            return d >= period.cycleStart && d <= period.cycleEnd;
          })
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        invoices.push({
          id: generateId(),
          userId,
          cardId,
          periodKey,
          periodStart: period.cycleStart.toISOString().slice(0, 10),
          periodEnd: period.cycleEnd.toISOString().slice(0, 10),
          closingDate: period.cycleEnd.toISOString().slice(0, 10),
          dueDate: period.dueDate.toISOString().slice(0, 10),
          total,
          status: "paid",
          paidAt: now,
          paidAmount: total,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (invoices.length > 0) await db.invoices.bulkPut(invoices);
    }

    localStorage.setItem(migratedFlagKey(userId), "1");
  } catch (err) {
    // Do not set the flag on failure — the migration will simply retry
    // (harmlessly, via bulkPut) next time the app loads.
    console.error("Migração para IndexedDB falhou, tentará novamente no próximo carregamento.", err);
  }
}
