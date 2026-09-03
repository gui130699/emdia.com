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
import { todayISO } from "../utils/date";
import type {
  AccountBill,
  BankAccount,
  Category,
  CreditCard,
  FinancialGoal,
  GoalContribution,
  Transaction,
} from "../types/finance";
import type { FinancialInstitution } from "../types/institution";

interface FinanceDataValue {
  loading: boolean;
  transactions: Transaction[];
  bills: AccountBill[];
  cards: CreditCard[];
  goals: FinancialGoal[];
  categories: Category[];
  bankAccounts: BankAccount[];

  addBankAccount: (name: string, kind: BankAccount["kind"], institution?: FinancialInstitution) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: Partial<TransactionInput>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  duplicateTransaction: (id: string) => Promise<void>;

  addBill: (input: AccountBillInput) => Promise<void>;
  updateBill: (id: string, input: Partial<AccountBillInput>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  markBillPaid: (id: string) => Promise<void>;
  markBillUnpaid: (id: string) => Promise<void>;

  addCard: (input: CreditCardInput) => Promise<void>;
  updateCard: (id: string, input: Partial<CreditCardInput>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;

  addGoal: (input: FinancialGoalInput) => Promise<void>;
  updateGoal: (id: string, input: Partial<FinancialGoalInput>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeGoal: (id: string, amount: number, kind: GoalContribution["kind"]) => Promise<void>;

  addCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (id: string, input: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const reloadAll = useCallback(async () => {
    if (!userId) return;
    const [t, b, c, g, cat, acc] = await Promise.all([
      transactionService.list(userId),
      accountService.list(userId),
      cardService.list(userId),
      goalService.list(userId),
      categoryService.list(userId),
      bankAccountService.list(userId),
    ]);
    setTransactions(t);
    setBills(b);
    setCards(c);
    setGoals(g);
    setCategories(cat);
    setBankAccounts(acc);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reloadAll().finally(() => setLoading(false));
  }, [userId, reloadAll]);

  const value = useMemo<FinanceDataValue>(
    () => ({
      loading,
      transactions,
      bills,
      cards,
      goals,
      categories,
      bankAccounts,

      async addBankAccount(name, kind, institution) {
        await bankAccountService.create(userId, name, kind, institution);
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
        if (bill?.transactionId) {
          await transactionService.remove(userId, bill.transactionId);
          setTransactions(await transactionService.list(userId));
        }
        await accountService.remove(userId, id);
        setBills(await accountService.list(userId));
      },
      async markBillPaid(id) {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return;
        // Paying a bill is a real expense: record it as a transaction so it
        // shows up in Despesas do mês, Relatórios and Gastos por categoria.
        const transaction = await transactionService.create(userId, {
          type: "expense",
          description: bill.description,
          amount: bill.amount,
          date: todayISO(),
          categoryId: bill.categoryId,
          accountId: bill.accountId ?? bankAccounts[0]?.id ?? "",
          paymentMethod: bill.paymentMethod ?? "boleto",
          recurring: false,
        });
        await accountService.markPaid(userId, id, transaction.id);
        setBills(await accountService.list(userId));
        setTransactions(await transactionService.list(userId));
      },
      async markBillUnpaid(id) {
        const bill = bills.find((b) => b.id === id);
        if (bill?.transactionId) {
          await transactionService.remove(userId, bill.transactionId);
          setTransactions(await transactionService.list(userId));
        }
        await accountService.markUnpaid(userId, id);
        setBills(await accountService.list(userId));
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
        await cardService.remove(userId, id);
        setCards(await cardService.list(userId));
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
      async deleteCategory(id) {
        await categoryService.remove(userId, id);
        setCategories(await categoryService.list(userId));
      },
    }),
    [loading, transactions, bills, cards, goals, categories, bankAccounts, userId]
  );

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}
