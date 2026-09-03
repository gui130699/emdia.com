import Dexie, { type Table } from "dexie";
import type {
  AccountBill,
  BalanceSnapshot,
  BankAccount,
  CategorizationRule,
  Category,
  CreditCard,
  FinancialGoal,
  ImportBatch,
  ImportMapping,
  Installment,
  InstallmentPlan,
  Invoice,
  Transaction,
  UserSettings,
} from "../types/finance";

export type SyncOperation = "create" | "update" | "delete";
export type SyncStatus = "pending" | "syncing" | "synced" | "error";

/** One entity mutation waiting to be pushed to Firestore. */
export interface SyncQueueItem {
  id: string;
  userId: string;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  createdAt: string;
  attempts: number;
  status: SyncStatus;
  lastError?: string;
  nextAttemptAt?: string;
}

/** Single-row table keyed by "current" so settings fit the same
 * get/put persistence model as everything else. */
export interface SettingsRow {
  key: "current";
  value: UserSettings;
}

export class EmDiaDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  accounts!: Table<BankAccount, string>;
  cards!: Table<CreditCard, string>;
  bills!: Table<AccountBill, string>;
  categories!: Table<Category, string>;
  goals!: Table<FinancialGoal, string>;
  settings!: Table<SettingsRow, string>;
  installmentPlans!: Table<InstallmentPlan, string>;
  installments!: Table<Installment, string>;
  invoices!: Table<Invoice, string>;
  importBatches!: Table<ImportBatch, string>;
  importMappings!: Table<ImportMapping, string>;
  categorizationRules!: Table<CategorizationRule, string>;
  balanceSnapshots!: Table<BalanceSnapshot, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor(userId: string) {
    super(`emdia-${userId}`);
    this.version(1).stores({
      transactions: "id, date, accountId, cardId, categoryId, type, importBatchId",
      accounts: "id, name",
      cards: "id, name",
      bills: "id, dueDate, status, categoryId",
      categories: "id, name",
      goals: "id",
      settings: "key",
      installmentPlans: "id, cardId",
      installments: "id, installmentPlanId, cardId, dueDate",
      invoices: "id, cardId, periodKey",
      importBatches: "id, createdAt",
      importMappings: "id, columnSignature",
      categorizationRules: "id, priority",
      syncQueue: "id, status, entity, createdAt",
    });
    this.version(2).stores({
      balanceSnapshots: "id, accountId, asOfDate, importBatchId",
    });
  }
}

const openDatabases = new Map<string, EmDiaDatabase>();

export function getDb(userId: string): EmDiaDatabase {
  let db = openDatabases.get(userId);
  if (!db) {
    db = new EmDiaDatabase(userId);
    openDatabases.set(userId, db);
  }
  return db;
}
