import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { transactionService, type TransactionInput } from "../services/transactionService";
import { accountService, type AccountBillInput } from "../services/accountService";
import { cardService, type CreditCardInput } from "../services/cardService";
import { goalService, type FinancialGoalInput } from "../services/goalService";
import { categoryService, type CategoryInput } from "../services/categoryService";
import { bankAccountService } from "../services/bankAccountService";
import { invoiceService } from "../services/invoiceService";
import { installmentService, type CreateInstallmentPlanInput } from "../services/installmentService";
import { categorizationRuleService } from "../services/categorizationRuleService";
import { balanceSnapshotService } from "../services/balanceSnapshotService";
import { computeAccountBalance, computeTotalBalance } from "../services/balanceService";
import { generateId } from "../services/localStore";
import { getCurrentInvoicePeriod, type InvoicePeriod } from "../utils/cardInvoice";
import { migrateFromLocalStorage } from "../db/migrateFromLocalStorage";
import { startSyncEngine, subscribeSyncStatus, type AggregateSyncStatus } from "../db/syncService";
import { importService } from "../services/importService";
import type {
  AccountBill,
  BalanceSnapshot,
  BankAccount,
  Category,
  CreditCard,
  FinancialGoal,
  GoalContribution,
  ImportBatch,
  Installment,
  InstallmentPlan,
  Invoice,
  PaymentMethod,
  Transaction,
} from "../types/finance";
import type { FinancialInstitution } from "../types/institution";

export interface BillPaymentInput {
  paymentMethod: PaymentMethod;
  date: string;
  amount: number;
  notes?: string;
  accountId?: string;
  cardId?: string;
  installments?: number;
}

export interface PayInvoiceInput {
  cardId: string;
  period: InvoicePeriod;
  total: number;
  accountId: string;
  date: string;
}

export interface OperationResult {
  ok: boolean;
  reason?: string;
}

interface FinanceDataValue {
  loading: boolean;
  syncStatus: AggregateSyncStatus;
  transactions: Transaction[];
  bills: AccountBill[];
  cards: CreditCard[];
  goals: FinancialGoal[];
  categories: Category[];
  bankAccounts: BankAccount[];
  invoices: Invoice[];
  installmentPlans: InstallmentPlan[];
  installments: Installment[];
  importBatches: ImportBatch[];
  balanceSnapshots: BalanceSnapshot[];

  getAccountBalance: (accountId: string) => number;
  totalBalance: number;
  getCategoryUsageCount: (categoryId: string) => number;

  addBankAccount: (
    name: string,
    kind: BankAccount["kind"],
    institution?: FinancialInstitution,
    initialBalance?: number,
    balanceAsOfDate?: string,
    externalIds?: { externalBankAccountId?: string; externalBranchId?: string }
  ) => Promise<BankAccount>;
  updateBankAccount: (id: string, patch: Partial<Omit<BankAccount, "id" | "userId">>) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  /** Records a bank-reported balance for an account (manual entry, an OFX
   * ledger balance, or an explicit reconciliation) and compares it against
   * what EM DIA computes for that same date — never silently overwrites
   * the calculated balance. */
  reconcileAccountBalance: (
    accountId: string,
    reportedBalance: number,
    asOfDate: string,
    source: BalanceSnapshot["source"],
    importBatchId?: string
  ) => Promise<{ calculated: number; reported: number; difference: number; status: "conferred" | "discrepancy" }>;
  createBalanceAdjustment: (accountId: string, amount: number, date: string, notes?: string) => Promise<void>;

  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  duplicateTransaction: (id: string) => Promise<void>;
  createInstallmentPurchase: (input: CreateInstallmentPlanInput) => Promise<void>;

  addBill: (input: AccountBillInput) => Promise<void>;
  updateBill: (id: string, input: Partial<AccountBillInput>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  payBill: (id: string, payment: BillPaymentInput) => Promise<OperationResult>;
  reopenBill: (id: string) => Promise<OperationResult>;

  addCard: (input: CreditCardInput) => Promise<void>;
  updateCard: (id: string, input: Partial<CreditCardInput>) => Promise<void>;
  /** Refuses (with a reason listing what's attached) when the card has any
   * purchases, invoices or installments — use archiveCard instead. */
  deleteCard: (id: string) => Promise<OperationResult>;
  archiveCard: (id: string) => Promise<void>;
  reactivateCard: (id: string) => Promise<void>;
  payInvoice: (input: PayInvoiceInput) => Promise<void>;
  reopenInvoice: (invoiceId: string) => Promise<void>;
  deleteInstallmentPlan: (id: string) => Promise<OperationResult>;

  addGoal: (input: FinancialGoalInput) => Promise<void>;
  updateGoal: (id: string, input: Partial<FinancialGoalInput>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeGoal: (id: string, amount: number, kind: GoalContribution["kind"]) => Promise<void>;

  addCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, input: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (id: string, reassignToId?: string) => Promise<void>;

  undoImportBatch: (id: string) => Promise<OperationResult>;

  reloadAll: () => Promise<void>;
}

const FinanceDataContext = createContext<FinanceDataValue | null>(null);

export function useFinanceData(): FinanceDataValue {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error("useFinanceData must be used within FinanceDataProvider");
  return ctx;
}

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";

  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<AggregateSyncStatus>("idle");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<BalanceSnapshot[]>([]);

  const reloadAll = useCallback(async () => {
    if (!userId) return;
    const [t, b, c, g, cat, acc, inv, plans, insts, batches, snapshots] = await Promise.all([
      transactionService.list(userId),
      accountService.list(userId),
      cardService.list(userId),
      goalService.list(userId),
      categoryService.list(userId),
      bankAccountService.list(userId),
      invoiceService.list(userId),
      installmentService.listPlans(userId),
      installmentService.listInstallments(userId),
      importService.listBatches(userId),
      balanceSnapshotService.list(userId),
    ]);
    setTransactions(t);
    setBills(b);
    setCards(c);
    setGoals(g);
    setCategories(cat);
    setBankAccounts(acc);
    setInvoices(inv);
    setInstallmentPlans(plans);
    setInstallments(insts);
    setImportBatches(batches);
    setBalanceSnapshots(snapshots);
    void categorizationRuleService.seedIfEmpty(userId, cat);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    migrateFromLocalStorage(userId)
      .then(reloadAll)
      .finally(() => setLoading(false));

    const stopEngine = startSyncEngine(userId);
    const unsubscribe = subscribeSyncStatus(setSyncStatus);
    return () => {
      stopEngine();
      unsubscribe();
    };
  }, [userId, reloadAll]);

  const value = useMemo<FinanceDataValue>(
    () => ({
      loading,
      syncStatus,
      transactions,
      bills,
      cards,
      goals,
      categories,
      bankAccounts,
      invoices,
      installmentPlans,
      installments,
      importBatches,
      balanceSnapshots,

      getAccountBalance(accountId) {
        const account = bankAccounts.find((a) => a.id === accountId);
        return account ? computeAccountBalance(account, transactions, balanceSnapshots) : 0;
      },
      totalBalance: computeTotalBalance(bankAccounts, transactions, balanceSnapshots),
      getCategoryUsageCount(categoryId) {
        return transactions.filter((t) => t.categoryId === categoryId).length;
      },

      async addBankAccount(name, kind, institution, initialBalance, balanceAsOfDate, externalIds) {
        const account = await bankAccountService.create(userId, {
          name,
          kind,
          institution,
          initialBalance,
          externalBankAccountId: externalIds?.externalBankAccountId,
          externalBranchId: externalIds?.externalBranchId,
        });
        if (initialBalance !== undefined && balanceAsOfDate) {
          await balanceSnapshotService.create(userId, {
            accountId: account.id,
            balance: initialBalance,
            asOfDate: balanceAsOfDate,
            source: "manual",
          });
          setBalanceSnapshots(await balanceSnapshotService.list(userId));
        }
        setBankAccounts(await bankAccountService.list(userId));
        return account;
      },
      async reconcileAccountBalance(accountId, reportedBalance, asOfDate, source, importBatchId) {
        // Reads fresh from IndexedDB rather than the React-state closure:
        // this is often called right after reloadAll() from the same
        // call site (e.g. right after committing an import), and the
        // closures captured here can still be one render behind that
        // reload — using them would compare against stale/empty data.
        const [freshAccount, freshTransactions] = await Promise.all([
          bankAccountService.get(userId, accountId),
          transactionService.list(userId),
        ]);
        const priorSnapshots = await balanceSnapshotService.listForAccount(userId, accountId);
        const relevantTransactions = freshTransactions.filter((t) => t.date <= asOfDate);
        const calculated = freshAccount ? computeAccountBalance(freshAccount, relevantTransactions, priorSnapshots) : reportedBalance;
        const difference = Math.round((reportedBalance - calculated) * 100) / 100;
        const status: "conferred" | "discrepancy" = Math.abs(difference) < 0.01 ? "conferred" : "discrepancy";

        await balanceSnapshotService.create(userId, { accountId, balance: reportedBalance, asOfDate, source, importBatchId });
        setBalanceSnapshots(await balanceSnapshotService.list(userId));

        await bankAccountService.update(userId, accountId, {
          reconciliationStatus: status,
          lastReconciledAt: new Date().toISOString(),
        });
        setBankAccounts(await bankAccountService.list(userId));

        return { calculated, reported: reportedBalance, difference, status };
      },
      async createBalanceAdjustment(accountId, amount, date, notes) {
        await transactionService.create(userId, {
          type: amount >= 0 ? "income" : "expense",
          description: "Ajuste de saldo",
          amount: Math.abs(amount),
          date,
          categoryId: "",
          accountId,
          paymentMethod: "transferencia",
          recurring: false,
          source: "system",
          transactionSubtype: "balance_adjustment",
          notes,
        });
        setTransactions(await transactionService.list(userId));
      },
      async updateBankAccount(id, patch) {
        await bankAccountService.update(userId, id, patch);
        setBankAccounts(await bankAccountService.list(userId));
      },
      async deleteBankAccount(id) {
        await bankAccountService.remove(userId, id);
        setBankAccounts(await bankAccountService.list(userId));
      },

      async addTransaction(input) {
        await transactionService.create(userId, input);
        setTransactions(await transactionService.list(userId));
      },
      async updateTransaction(id, input) {
        await transactionService.update(userId, id, input);
        setTransactions(await transactionService.list(userId));
      },
      async deleteTransaction(id) {
        await transactionService.remove(userId, id);
        setTransactions(await transactionService.list(userId));
      },
      async duplicateTransaction(id) {
        await transactionService.duplicate(userId, id);
        setTransactions(await transactionService.list(userId));
      },
      async createInstallmentPurchase(input) {
        await installmentService.create(userId, input);
        setTransactions(await transactionService.list(userId));
        setInstallmentPlans(await installmentService.listPlans(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async addBill(input) {
        await accountService.create(userId, input);
        setBills(await accountService.list(userId));
      },
      async updateBill(id, input) {
        await accountService.update(userId, id, input);
        setBills(await accountService.list(userId));
      },
      async deleteBill(id) {
        const bill = bills.find((b) => b.id === id);
        if (bill?.installmentPlanId) {
          await installmentService.deletePlan(userId, bill.installmentPlanId);
        } else if (bill?.paymentTransactionId) {
          await transactionService.remove(userId, bill.paymentTransactionId);
        }
        await accountService.remove(userId, id);
        setBills(await accountService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallmentPlans(await installmentService.listPlans(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async payBill(id, payment) {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return { ok: false, reason: "Conta não encontrada." };

        if (payment.paymentMethod === "credito") {
          if (!payment.cardId) return { ok: false, reason: "Selecione o cartão de crédito." };

          if (payment.installments && payment.installments > 1) {
            const plan = await installmentService.create(userId, {
              sourceType: "bill",
              sourceId: id,
              cardId: payment.cardId,
              description: bill.description,
              categoryId: bill.categoryId,
              totalAmount: payment.amount,
              installmentCount: payment.installments,
              firstInstallmentDate: payment.date,
              paymentMethod: "credito",
            });
            await accountService.markPaid(userId, id, {
              paymentMethod: "credito",
              paidAt: payment.date,
              paidAmount: payment.amount,
              paidCardId: payment.cardId,
              installmentPlanId: plan.id,
            });
          } else {
            const transaction = await transactionService.create(userId, {
              type: "expense",
              description: `Pagamento — ${bill.description}`,
              amount: payment.amount,
              date: payment.date,
              categoryId: bill.categoryId,
              accountId: "",
              cardId: payment.cardId,
              paymentMethod: "credito",
              recurring: false,
              notes: payment.notes,
              source: "manual",
              originType: "bill",
              originId: id,
            });
            await accountService.markPaid(userId, id, {
              paymentMethod: "credito",
              paidAt: payment.date,
              paidAmount: payment.amount,
              paidCardId: payment.cardId,
              paymentTransactionId: transaction.id,
            });
          }
        } else {
          if (!payment.accountId) return { ok: false, reason: "Selecione a conta utilizada." };
          const transaction = await transactionService.create(userId, {
            type: "expense",
            description: `Pagamento — ${bill.description}`,
            amount: payment.amount,
            date: payment.date,
            categoryId: bill.categoryId,
            accountId: payment.accountId,
            paymentMethod: payment.paymentMethod,
            recurring: false,
            notes: payment.notes,
            source: "manual",
            originType: "bill",
            originId: id,
          });
          await accountService.markPaid(userId, id, {
            paymentMethod: payment.paymentMethod,
            paidAt: payment.date,
            paidAmount: payment.amount,
            paidAccountId: payment.accountId,
            paymentTransactionId: transaction.id,
          });
        }

        setBills(await accountService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallmentPlans(await installmentService.listPlans(userId));
        setInstallments(await installmentService.listInstallments(userId));
        return { ok: true };
      },

      async reopenBill(id) {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return { ok: false, reason: "Conta não encontrada." };

        if (bill.installmentPlanId) {
          const result = await installmentService.deletePlan(userId, bill.installmentPlanId);
          if (!result.ok) return result;
        } else if (bill.paymentTransactionId) {
          await transactionService.remove(userId, bill.paymentTransactionId);
        }

        await accountService.markUnpaid(userId, id);
        setBills(await accountService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallmentPlans(await installmentService.listPlans(userId));
        setInstallments(await installmentService.listInstallments(userId));
        return { ok: true };
      },

      async addCard(input) {
        await cardService.create(userId, input);
        setCards(await cardService.list(userId));
      },
      async updateCard(id, input) {
        await cardService.update(userId, id, input);
        setCards(await cardService.list(userId));
      },
      async deleteCard(id) {
        const purchaseCount = transactions.filter((t) => t.cardId === id).length;
        const invoiceCount = invoices.filter((inv) => inv.cardId === id).length;
        const planCount = installmentPlans.filter((p) => p.cardId === id).length;
        if (purchaseCount > 0 || invoiceCount > 0 || planCount > 0) {
          return {
            ok: false,
            reason: `Este cartão possui ${purchaseCount} compra(s), ${invoiceCount} fatura(s) e ${planCount} parcelamento(s) vinculados. Arquive o cartão em vez de excluí-lo.`,
          };
        }
        await cardService.remove(userId, id);
        setCards(await cardService.list(userId));
        return { ok: true };
      },
      async archiveCard(id) {
        await cardService.update(userId, id, { archived: true, archivedAt: new Date().toISOString() });
        setCards(await cardService.list(userId));
      },
      async reactivateCard(id) {
        await cardService.update(userId, id, { archived: false, archivedAt: undefined });
        setCards(await cardService.list(userId));
      },

      async payInvoice({ cardId, period, total, accountId, date }) {
        const invoiceId = generateId();
        const transaction = await transactionService.create(userId, {
          type: "expense",
          description: "Pagamento de fatura",
          amount: total,
          date,
          categoryId: "",
          accountId,
          cardId,
          paymentMethod: "debito",
          recurring: false,
          source: "manual",
          originType: "credit_card_invoice",
          originId: invoiceId,
        });
        await invoiceService.recordPayment(userId, cardId, period, total, accountId, transaction.id, invoiceId);
        await installmentService.markInstallmentsPaid(userId, cardId, period.cycleStart, period.cycleEnd);

        setInvoices(await invoiceService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async reopenInvoice(invoiceId) {
        const invoice = await invoiceService.get(userId, invoiceId);
        if (!invoice) return;
        if (invoice.paymentTransactionId) {
          await transactionService.remove(userId, invoice.paymentTransactionId);
        }
        const card = cards.find((c) => c.id === invoice.cardId);
        if (card) {
          const period = getCurrentInvoicePeriod(card, new Date(invoice.periodEnd + "T00:00:00"));
          await installmentService.markInstallmentsUnpaid(userId, invoice.cardId, period.cycleStart, period.cycleEnd);
        }
        await invoiceService.remove(userId, invoiceId);

        setInvoices(await invoiceService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async deleteInstallmentPlan(id) {
        const result = await installmentService.deletePlan(userId, id);
        setTransactions(await transactionService.list(userId));
        setInstallmentPlans(await installmentService.listPlans(userId));
        setInstallments(await installmentService.listInstallments(userId));
        return result;
      },

      async addGoal(input) {
        await goalService.create(userId, input);
        setGoals(await goalService.list(userId));
      },
      async updateGoal(id, input) {
        await goalService.update(userId, id, input);
        setGoals(await goalService.list(userId));
      },
      async deleteGoal(id) {
        await goalService.remove(userId, id);
        setGoals(await goalService.list(userId));
      },
      async contributeGoal(id, amount, kind) {
        await goalService.contribute(userId, id, amount, kind);
        setGoals(await goalService.list(userId));
      },

      async addCategory(input) {
        await categoryService.create(userId, input);
        setCategories(await categoryService.list(userId));
      },
      async updateCategory(id, input) {
        await categoryService.update(userId, id, input);
        setCategories(await categoryService.list(userId));
      },
      async deleteCategory(id, reassignToId) {
        if (reassignToId) {
          const affected = transactions.filter((t) => t.categoryId === id);
          for (const t of affected) {
            await transactionService.update(userId, t.id, { categoryId: reassignToId });
          }
        }
        await categoryService.remove(userId, id);
        setCategories(await categoryService.list(userId));
        setTransactions(await transactionService.list(userId));
      },

      async undoImportBatch(id) {
        const result = await importService.undo(userId, id);
        setTransactions(await transactionService.list(userId));
        setImportBatches(await importService.listBatches(userId));
        return result;
      },

      reloadAll,
    }),
    [
      loading,
      syncStatus,
      transactions,
      bills,
      cards,
      goals,
      categories,
      bankAccounts,
      invoices,
      installmentPlans,
      installments,
      importBatches,
      balanceSnapshots,
      userId,
      reloadAll,
    ]
  );

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}
