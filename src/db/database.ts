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
  ImportProfile,
  Installment,
  InstallmentPlan,
  Invoice,
  InvoicePayment,
  ReconciliationAlias,
  RecurringBillRule,
  Transaction,
  UserProfile,
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
  updatedAt?: string;
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
  invoicePayments!: Table<InvoicePayment, string>;
  importBatches!: Table<ImportBatch, string>;
  importMappings!: Table<ImportMapping, string>;
  importProfiles!: Table<ImportProfile, string>;
  categorizationRules!: Table<CategorizationRule, string>;
  balanceSnapshots!: Table<BalanceSnapshot, string>;
  userProfile!: Table<UserProfile, string>;
  recurringBillRules!: Table<RecurringBillRule, string>;
  reconciliationAliases!: Table<ReconciliationAlias, string>;
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
    this.version(3).stores({
      userProfile: "id",
    });
    this.version(4).stores({
      recurringBillRules: "id, status",
      bills: "id, dueDate, status, categoryId, recurringRuleId",
    });
    this.version(5).stores({
      reconciliationAliases: "id, normalizedBankDescription, targetType",
    });
    this.version(6)
      .stores({
        transactions: "id, date, accountId, cardId, relatedCardId, categoryId, type, importBatchId, externalRecordId",
        invoicePayments: "id, invoiceId, cardId, paymentDate, bankTransactionId, status",
        importProfiles: "id, institutionCode, sourceFormat",
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        const transactionTable = tx.table("transactions");
        const invoicePaymentTable = tx.table("invoicePayments");
        const transactions = (await transactionTable.toArray()) as Transaction[];

        // A bank-side invoice payment used to carry cardId, which made it a
        // card purchase and removed it from cash-flow reports. Move that
        // relationship to relatedCardId and create an auditable payment row.
        for (const transaction of transactions) {
          if (
            transaction.originType === "credit_card_invoice" &&
            transaction.accountId &&
            transaction.cardId
          ) {
            const cardId = transaction.cardId;
            const { cardId: _discardedCardId, ...withoutCardId } = transaction;
            void _discardedCardId;
            const migrated: Transaction = {
              ...withoutCardId,
              relatedCardId: cardId,
              updatedAt: now,
            };
            await transactionTable.put(migrated);
            if (transaction.originId) {
              const payment: InvoicePayment = {
                id: `legacy-${transaction.id}`,
                userId: transaction.userId,
                invoiceId: transaction.originId,
                cardId,
                amount: transaction.amount,
                paymentDate: transaction.date,
                bankAccountId: transaction.accountId,
                bankTransactionId: transaction.id,
                source: transaction.source === "import" ? "import" : "manual",
                status: "confirmed",
                createdAt: transaction.createdAt,
                updatedAt: now,
              };
              await invoicePaymentTable.put(payment);
            }
          }
        }

        // Imported plans first observed at N>1 gain explicit historical
        // positions. No retroactive Transaction is created.
        const planTable = tx.table("installmentPlans");
        const installmentTable = tx.table("installments");
        const plans = (await planTable.toArray()) as InstallmentPlan[];
        for (const plan of plans.filter((candidate) => candidate.sourceType === "import")) {
          const planInstallments = ((await installmentTable
            .where("installmentPlanId")
            .equals(plan.id)
            .toArray()) as Installment[]).sort((a, b) => a.number - b.number);
          const first = planInstallments[0];
          if (!first || first.number <= 1) continue;

          const firstDate = new Date(`${first.dueDate}T00:00:00`);
          for (let number = 1; number < first.number; number++) {
            const due = new Date(firstDate);
            due.setMonth(due.getMonth() - (first.number - number));
            const dueDate = [
              due.getFullYear(),
              String(due.getMonth() + 1).padStart(2, "0"),
              String(due.getDate()).padStart(2, "0"),
            ].join("-");
            const historical: Installment = {
              id: `historical-${plan.id}-${number}`,
              userId: plan.userId,
              installmentPlanId: plan.id,
              cardId: plan.cardId,
              number,
              totalInstallments: plan.installmentCount,
              amount: first.amount,
              dueDate,
              status: "historical",
              createdAt: plan.createdAt,
              updatedAt: now,
            };
            await installmentTable.put(historical);
          }

          await installmentTable.update(first.id, {
            status: "billed",
            observedAt: first.createdAt,
            updatedAt: now,
          });
          await planTable.update(plan.id, {
            trackingStartNumber: first.number,
            currentObservedNumber: first.number,
            priorInstallmentsTreatment: "historical",
            totalAmountEstimated: true,
            updatedAt: now,
          });
        }

        // Old import-created defaults cannot safely be erased: a real zero
        // or day 5/15 is possible. Flag only the strongest candidates.
        const cardTable = tx.table("cards");
        const cards = (await cardTable.toArray()) as CreditCard[];
        for (const card of cards) {
          if (!card.externalCardAccountId) continue;
          const reviewFields: CreditCard["reviewFields"] = [];
          if (card.limit === 0) reviewFields.push("limit");
          if (card.closingDay === 5) reviewFields.push("closingDay");
          if (card.dueDay === 15) reviewFields.push("dueDay");
          if (reviewFields.length > 0) {
            await cardTable.update(card.id, { reviewFields, updatedAt: now });
          }
        }

        const accountTable = tx.table("accounts");
        const snapshotTable = tx.table("balanceSnapshots");
        const accounts = (await accountTable.toArray()) as BankAccount[];
        const snapshots = (await snapshotTable.toArray()) as BalanceSnapshot[];
        const accountsById = new Map(accounts.map((account) => [account.id, account]));
        for (const snapshot of snapshots) {
          const account = accountsById.get(snapshot.accountId);
          if (!account?.externalBankAccountId || snapshot.source !== "manual" || snapshot.balance !== 0 || snapshot.importBatchId) {
            continue;
          }
          const createdTogether = Math.abs(
            new Date(snapshot.createdAt).getTime() - new Date(account.createdAt).getTime()
          ) <= 5 * 60 * 1000;
          if (createdTogether) {
            await snapshotTable.update(snapshot.id, { reviewStatus: "needs_review", updatedAt: now });
          }
        }
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
