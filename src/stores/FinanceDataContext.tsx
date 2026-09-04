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
import { invoicePaymentService } from "../services/invoicePaymentService";
import { installmentService, type CreateInstallmentPlanInput } from "../services/installmentService";
import { categorizationRuleService } from "../services/categorizationRuleService";
import { balanceSnapshotService } from "../services/balanceSnapshotService";
import { recurringBillRuleService, type RecurringBillRuleInput } from "../services/recurringBillRuleService";
import { computeAccountBalance, computeTotalBalance, countUnknownAccountBalances } from "../services/balanceService";
import { generateId } from "../services/localStore";
import {
  cardInvoiceComposition,
  getCurrentInvoicePeriod,
  transactionsInPeriod,
  type InvoicePeriod,
} from "../utils/cardInvoice";
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
  InvoicePayment,
  PaymentMethod,
  RecurringBillRule,
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
  /** The real invoice total, independent of how much is being paid now. */
  invoiceTotal: number;
  /** What's actually being paid in this transaction — can be less than
   * invoiceTotal for a partial payment. */
  amountPaid: number;
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
  invoicePayments: InvoicePayment[];
  installmentPlans: InstallmentPlan[];
  installments: Installment[];
  importBatches: ImportBatch[];
  balanceSnapshots: BalanceSnapshot[];
  recurringBillRules: RecurringBillRule[];

  getAccountBalance: (accountId: string) => number | undefined;
  totalBalance: number | undefined;
  unknownBalanceAccountCount: number;
  getCategoryUsageCount: (categoryId: string) => number;

  addBankAccount: (
    name: string,
    kind: BankAccount["kind"],
    institution?: FinancialInstitution,
    initialBalance?: number,
    balanceAsOfDate?: string,
    externalIds?: { externalBankAccountId?: string; externalBranchId?: string; currency?: string }
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
    importBatchId?: string,
    metadata?: {
      availableBalance?: number;
      asOfDateTime?: string;
      institutionCode?: string;
      externalBankAccountId?: string;
    }
  ) => Promise<{ calculated?: number; reported: number; difference?: number; status: "conferred" | "discrepancy" | "initial_reference" }>;
  createBalanceAdjustment: (accountId: string, amount: number, date: string, notes?: string) => Promise<void>;

  /** Records the bank's own reported statement position for a card's
   * current cycle (BALAMT from a card OFX) so it can be compared against
   * what EM DIA computed from the imported transactions — a mismatch
   * usually means a statement line (saldo anterior, encargos, um
   * pagamento) wasn't selected during import, not that either figure is
   * wrong. Returns undefined when the card has no computable cycle yet
   * (fechamento/vencimento not informed). */
  recordCardStatement: (
    cardId: string,
    statementBalance: number,
    metadata?: {
      rawStatementBalance?: number;
      asOfDate?: string;
      asOfDateTime?: string;
      periodStart?: string;
      periodEnd?: string;
      importBatchId?: string;
    }
  ) => Promise<{ computedTotal: number; statementBalance: number; difference: number } | undefined>;

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

  addCard: (input: CreditCardInput) => Promise<CreditCard>;
  updateCard: (id: string, input: Partial<CreditCardInput>) => Promise<void>;
  /** Refuses (with a reason listing what's attached) when the card has any
   * purchases, invoices or installments — use archiveCard instead. */
  deleteCard: (id: string) => Promise<OperationResult>;
  archiveCard: (id: string) => Promise<void>;
  reactivateCard: (id: string) => Promise<void>;
  payInvoice: (input: PayInvoiceInput) => Promise<void>;
  reopenInvoice: (invoiceId: string) => Promise<void>;
  /** Deletes just the Invoice record for an open/closed/overdue cycle —
   * refused for paid/partial (reopen those first). Never removes the
   * underlying transactions; when the invoice came from an import, the
   * returned importBatchId lets the caller offer undoImportBatch as a
   * separate, opt-in next step for removing those too. */
  deleteInvoice: (invoiceId: string) => Promise<OperationResult & { importBatchId?: string }>;
  deleteInstallmentPlan: (id: string) => Promise<OperationResult>;

  addGoal: (input: FinancialGoalInput) => Promise<void>;
  updateGoal: (id: string, input: Partial<FinancialGoalInput>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeGoal: (id: string, amount: number, kind: GoalContribution["kind"]) => Promise<void>;

  addCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, input: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (id: string, reassignToId?: string) => Promise<void>;

  undoImportBatch: (id: string) => Promise<OperationResult>;
  /** Deletes the ImportBatch history entry itself — only ever allowed once
   * it's already "undone". Never touches categorizationRules,
   * importMappings, importProfiles or reconciliationAliases. */
  deleteImportBatchRecord: (id: string) => Promise<OperationResult>;
  /** Bulk version — clears every already-undone batch at once. Returns how
   * many were removed. */
  clearUndoneImportBatches: () => Promise<number>;

  addRecurringRule: (input: RecurringBillRuleInput) => Promise<void>;
  updateRecurringRule: (id: string, patch: Partial<RecurringBillRuleInput>, cascadeToFuture: boolean) => Promise<void>;
  pauseRecurringRule: (id: string, removeFutureUnpaid: boolean) => Promise<void>;
  reactivateRecurringRule: (id: string) => Promise<void>;
  endRecurringRule: (id: string, removeFutureUnpaid: boolean) => Promise<void>;
  deleteRecurringRule: (id: string) => Promise<OperationResult>;

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
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<BalanceSnapshot[]>([]);
  const [recurringBillRules, setRecurringBillRules] = useState<RecurringBillRule[]>([]);

  const reloadAll = useCallback(async () => {
    if (!userId) return;
    // Idempotent: only creates occurrences missing from the rolling
    // window, so this is safe to run on every reload.
    await recurringBillRuleService.generateForAllActiveRules(userId);

    const [t, b, c, g, cat, acc, inv, payments, plans, insts, batches, snapshots, rules] = await Promise.all([
      transactionService.list(userId),
      accountService.list(userId),
      cardService.list(userId),
      goalService.list(userId),
      categoryService.list(userId),
      bankAccountService.list(userId),
      invoiceService.list(userId),
      invoicePaymentService.list(userId),
      installmentService.listPlans(userId),
      installmentService.listInstallments(userId),
      importService.listBatches(userId),
      balanceSnapshotService.list(userId),
      recurringBillRuleService.list(userId),
    ]);
    setTransactions(t);
    setBills(b);
    setCards(c);
    setGoals(g);
    setCategories(cat);
    setBankAccounts(acc);
    setInvoices(inv);
    setInvoicePayments(payments);
    setInstallmentPlans(plans);
    setInstallments(insts);
    setImportBatches(batches);
    setBalanceSnapshots(snapshots);
    setRecurringBillRules(rules);
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

    const stopEngine = startSyncEngine(userId, reloadAll);
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
      invoicePayments,
      installmentPlans,
      installments,
      importBatches,
      balanceSnapshots,
      recurringBillRules,

      getAccountBalance(accountId) {
        const account = bankAccounts.find((a) => a.id === accountId);
        return account ? computeAccountBalance(account, transactions, balanceSnapshots) : undefined;
      },
      totalBalance: computeTotalBalance(bankAccounts, transactions, balanceSnapshots),
      unknownBalanceAccountCount: countUnknownAccountBalances(bankAccounts, transactions, balanceSnapshots),
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
          currency: externalIds?.currency,
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
      async reconcileAccountBalance(accountId, reportedBalance, asOfDate, source, importBatchId, metadata) {
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
        // Restricted to snapshots at-or-before asOfDate: comparing a
        // historical file's balance against a "calculated" figure that
        // silently used a *later*-dated snapshot as its base (e.g.
        // reconciling an old statement after a more recent one was already
        // recorded) would compare against the wrong baseline entirely.
        const calculated = freshAccount
          ? computeAccountBalance(freshAccount, relevantTransactions, priorSnapshots, asOfDate)
          : reportedBalance;
        const difference = calculated === undefined
          ? undefined
          : Math.round((reportedBalance - calculated) * 100) / 100;
        // With no prior snapshot at all, "calculated" is just initialBalance
        // (0 for a fresh account) plus whatever transactions this same
        // import just created — comparing that against the bank's real
        // balance is comparing against a baseline that was never
        // established, not a real discrepancy. The bank's number becomes
        // the new reference point instead of a false warning.
        const hasEarlierSnapshot = priorSnapshots.some((s) => s.asOfDate <= asOfDate);
        // A manual entry is the user directly asserting "this is the real
        // balance" — there's nothing to check it against; flagging it as
        // its own "discrepancy" (which happens if it doesn't match a
        // calculation based on whatever was previously on record, possibly
        // itself wrong) would defeat the purpose of a manual correction.
        const status: "conferred" | "discrepancy" | "initial_reference" = !hasEarlierSnapshot
          ? "initial_reference"
          : source === "manual" || (difference !== undefined && Math.abs(difference) < 0.01)
            ? "conferred"
            : "discrepancy";

        await balanceSnapshotService.create(userId, {
          accountId,
          balance: reportedBalance,
          availableBalance: metadata?.availableBalance,
          asOfDate,
          asOfDateTime: metadata?.asOfDateTime,
          source,
          importBatchId,
          institutionCode: metadata?.institutionCode,
          externalBankAccountId: metadata?.externalBankAccountId,
        });
        setBalanceSnapshots(await balanceSnapshotService.list(userId));

        await bankAccountService.update(userId, accountId, {
          reconciliationStatus: status,
          lastReconciledAt: new Date().toISOString(),
        });
        setBankAccounts(await bankAccountService.list(userId));

        return { calculated, reported: reportedBalance, difference, status };
      },
      async recordCardStatement(cardId, statementBalance, metadata) {
        const [freshCard, freshTransactions] = await Promise.all([
          cardService.get(userId, cardId),
          transactionService.list(userId),
        ]);
        if (!freshCard) return undefined;
        const referenceDate = metadata?.asOfDate
          ? new Date(`${metadata.asOfDate}T12:00:00`)
          : new Date();
        const period = getCurrentInvoicePeriod(freshCard, referenceDate);
        const statementTransactions = period
          ? transactionsInPeriod(freshTransactions, cardId, period)
          : freshTransactions.filter(
              (transaction) =>
                transaction.cardId === cardId &&
                (!metadata?.periodStart || transaction.date >= metadata.periodStart) &&
                (!metadata?.periodEnd || transaction.date <= metadata.periodEnd)
            );
        const composition = cardInvoiceComposition(statementTransactions);
        const computedTotal = composition.computedTotal;
        await invoiceService.recordStatementSnapshot(
          userId,
          cardId,
          period,
          {
            statementBalance,
            rawStatementBalance: metadata?.rawStatementBalance,
            asOfDate: metadata?.asOfDate,
            asOfDateTime: metadata?.asOfDateTime,
            periodStart: metadata?.periodStart,
            periodEnd: metadata?.periodEnd,
            importBatchId: metadata?.importBatchId,
          },
          computedTotal,
          composition
        );
        setInvoices(await invoiceService.list(userId));
        const difference = Math.round((statementBalance - computedTotal) * 100) / 100;
        return { computedTotal, statementBalance, difference };
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
        const card = await cardService.create(userId, input);
        setCards(await cardService.list(userId));
        return card;
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

      async payInvoice({ cardId, period, invoiceTotal, amountPaid, accountId, date }) {
        const existing = await invoiceService.findByPeriod(userId, cardId, period.periodKey);
        const invoiceId = existing?.id ?? generateId();
        const transaction = await transactionService.create(userId, {
          type: "payment",
          description: amountPaid < invoiceTotal ? "Pagamento parcial de fatura" : "Pagamento de fatura",
          amount: amountPaid,
          date,
          categoryId: "",
          accountId,
          relatedCardId: cardId,
          paymentMethod: "debito",
          recurring: false,
          source: "manual",
          originType: "credit_card_invoice",
          originId: invoiceId,
        });
        const invoice = await invoiceService.recordPayment(
          userId,
          cardId,
          period,
          invoiceTotal,
          amountPaid,
          accountId,
          transaction.id,
          invoiceId,
          "manual",
          date
        );
        // A partial payment doesn't settle any specific parcela — only mark
        // installments paid once the invoice is fully covered.
        if (invoice.status === "paid") {
          await installmentService.markInstallmentsPaid(userId, cardId, period.cycleStart, period.cycleEnd);
        }

        setInvoices(await invoiceService.list(userId));
        setInvoicePayments(await invoicePaymentService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async reopenInvoice(invoiceId) {
        const invoice = await invoiceService.get(userId, invoiceId);
        if (!invoice) return;
        // A partial payment leaves more than one payment transaction linked
        // to the same invoice (originId) — remove all of them, not just the
        // most recent one referenced by paymentTransactionId.
        const payments = await invoicePaymentService.listForInvoice(userId, invoice.id);
        for (const payment of payments.filter((candidate) => candidate.status !== "reversed")) {
          if (!payment.bankTransactionId) continue;
          const transaction = await transactionService.get(userId, payment.bankTransactionId);
          if (!transaction) continue;
          if (transaction.source === "import") {
            await transactionService.update(userId, transaction.id, {
              originType: undefined,
              originId: undefined,
              relatedCardId: undefined,
            });
          } else {
            await transactionService.reverse(userId, transaction.id);
          }
        }
        await invoicePaymentService.reverseForInvoice(userId, invoice.id);
        const card = cards.find((c) => c.id === invoice.cardId);
        const period = card && invoice.periodEnd
          ? getCurrentInvoicePeriod(card, new Date(`${invoice.periodEnd}T00:00:00`))
          : undefined;
        if (period) {
          await installmentService.markInstallmentsUnpaid(userId, invoice.cardId, period.cycleStart, period.cycleEnd);
        }
        await invoiceService.remove(userId, invoiceId);

        setInvoices(await invoiceService.list(userId));
        setInvoicePayments(await invoicePaymentService.list(userId));
        setTransactions(await transactionService.list(userId));
        setInstallments(await installmentService.listInstallments(userId));
      },

      async deleteInvoice(invoiceId) {
        const result = await invoiceService.deleteRecord(userId, invoiceId);
        if (result.ok) {
          setInvoices(await invoiceService.list(userId));
        }
        return result;
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
        await reloadAll();
        return result;
      },
      async deleteImportBatchRecord(id) {
        const result = await importService.deleteBatchRecord(userId, id);
        if (result.ok) {
          setImportBatches(await importService.listBatches(userId));
        }
        return result;
      },
      async clearUndoneImportBatches() {
        const count = await importService.clearUndoneBatches(userId);
        setImportBatches(await importService.listBatches(userId));
        return count;
      },

      async addRecurringRule(input) {
        await recurringBillRuleService.create(userId, input);
        await recurringBillRuleService.generateForAllActiveRules(userId);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
      },
      async updateRecurringRule(id, patch, cascadeToFuture) {
        await recurringBillRuleService.update(userId, id, patch, cascadeToFuture, bills);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
      },
      async pauseRecurringRule(id, removeFutureUnpaid) {
        await recurringBillRuleService.pause(userId, id, removeFutureUnpaid, bills);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
      },
      async reactivateRecurringRule(id) {
        await recurringBillRuleService.reactivate(userId, id);
        await recurringBillRuleService.generateForAllActiveRules(userId);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
      },
      async endRecurringRule(id, removeFutureUnpaid) {
        await recurringBillRuleService.end(userId, id, removeFutureUnpaid, bills);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
      },
      async deleteRecurringRule(id) {
        const result = await recurringBillRuleService.deleteRule(userId, id, bills);
        setRecurringBillRules(await recurringBillRuleService.list(userId));
        setBills(await accountService.list(userId));
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
      invoicePayments,
      installmentPlans,
      installments,
      importBatches,
      balanceSnapshots,
      recurringBillRules,
      userId,
      reloadAll,
    ]
  );

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}
