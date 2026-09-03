export type BankAccountKind = "corrente" | "poupanca" | "digital" | "carteira";

export interface BankAccount {
  id: string;
  userId: string;
  name: string;
  kind: BankAccountKind;
  institutionCode?: string;
  institutionName?: string;
  institutionFullName?: string;
  institutionIspb?: string;
  institutionLogoUrl?: string;
  createdAt: string;
}

export type TransactionType = "income" | "expense";

export type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "debito"
  | "credito"
  | "boleto"
  | "transferencia";

export type RecurringFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string; // ISO yyyy-MM-dd
  categoryId: string;
  accountId: string;
  cardId?: string;
  paymentMethod: PaymentMethod;
  recurring: boolean;
  recurringFrequency?: RecurringFrequency;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillStatus = "paid" | "upcoming" | "overdue";

export interface AccountBill {
  id: string;
  userId: string;
  description: string;
  amount: number;
  dueDate: string; // ISO yyyy-MM-dd
  categoryId: string;
  status: BillStatus;
  recurring: boolean;
  recurringFrequency?: RecurringFrequency;
  paymentMethod?: PaymentMethod;
  accountId?: string;
  notes?: string;
  paidAt?: string;
  /** Expense transaction created when this bill was marked as paid, so it's
   * reflected in Despesas/Relatórios/Gastos por categoria. */
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CardType = "credito" | "debito";

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  institution: string;
  institutionCode?: string;
  institutionIspb?: string;
  institutionLogoUrl?: string;
  type: CardType;
  lastFourDigits: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  accountId?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  kind: "deposit" | "withdrawal";
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  currentAmount: number;
  targetAmount: number;
  deadline: string;
  icon: string;
  categoryId?: string;
  contributions: GoalContribution[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType | "both";
  icon: string;
  color: string;
  isDefault?: boolean;
}

export type ThemePreference = "light" | "dark" | "system";
export type InterfaceDensity = "comfortable" | "compact";

export interface NotificationPreferences {
  email: boolean;
  billReminders: boolean;
  goalReminders: boolean;
  importantAlerts: boolean;
  promotions: boolean;
}

export interface AppearancePreferences {
  theme: ThemePreference;
  accentColor: string;
  density: InterfaceDensity;
}

export interface UserSettings {
  notifications: NotificationPreferences;
  appearance: AppearancePreferences;
}
