export type BankAccountKind = "corrente" | "poupanca" | "digital" | "carteira" | "outro";

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
  /** Starting balance when the account was registered in EM DIA. The
   * current balance is always computed (initialBalance + movements),
   * never stored/edited directly. */
  initialBalance: number;
  createdAt: string;
  updatedAt: string;
}

/** income/expense/transfer only — "both" is a Category-applicability
 * concept, not a real transaction kind. */
export type TransactionType = "income" | "expense" | "transfer";
export type CategoryApplicableType = "income" | "expense" | "both";

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

export type TransactionSource = "manual" | "import";
export type ImportSource = "ofx" | "csv" | "pdf";

/** What generated this transaction, for reporting/dedup/undo purposes. */
export type TransactionOriginType =
  | "bill"
  | "credit_card_invoice"
  | "installment"
  | "transfer"
  | "bank_import"
  | "card_import";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string; // ISO yyyy-MM-dd
  categoryId: string;
  /** Required for income/expense outside credit card; the account debited
   * or credited. For type="transfer" this is the source account. */
  accountId: string;
  /** Only set for type="transfer": the account that received the funds. */
  destinationAccountId?: string;
  /** Groups the two legs conceptually (kept as a single record today, but
   * reserved so a future two-leg model can share this key without a
   * migration). */
  transferId?: string;
  /** Required for credit-card purchases; mutually exclusive in practice
   * with accountId being "the account debited now" (credit purchases only
   * reduce a bank balance when the invoice is paid). */
  cardId?: string;
  paymentMethod: PaymentMethod;
  recurring: boolean;
  recurringFrequency?: RecurringFrequency;
  notes?: string;

  /** Who created this movement. */
  source: TransactionSource;
  originType?: TransactionOriginType;
  originId?: string;
  /** Links an installment transaction back to its plan/number. */
  installmentPlanId?: string;
  installmentNumber?: number;

  // Import metadata (only set when source === "import")
  importSource?: ImportSource;
  importBatchId?: string;
  externalId?: string;
  rawDescription?: string;
  normalizedDescription?: string;
  importedAt?: string;
  importConfidence?: number;

  // Reversal (used by "reabrir pagamento" instead of hard-deleting when a
  // transaction might be referenced elsewhere)
  isReversed?: boolean;
  reversedAt?: string;

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
  /** Suggested account (shown pre-selected when paying), not a requirement. */
  accountId?: string;
  notes?: string;

  // Populated only once the bill is actually paid — cleared entirely on
  // "reabrir pagamento".
  paidAt?: string;
  paidAmount?: number;
  paidAccountId?: string;
  paidCardId?: string;
  paymentTransactionId?: string;
  /** Set when paid via credit card and split into installments. */
  installmentPlanId?: string;

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
  /** Suggested account for paying this card's invoice. */
  accountId?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "open" | "closed" | "paid" | "overdue";

export interface Invoice {
  id: string;
  userId: string;
  cardId: string;
  periodKey: string; // yyyy-MM of the closing date, stable identifier
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string;
  total: number;
  status: InvoiceStatus;
  paidAt?: string;
  paidAmount?: number;
  paidAccountId?: string;
  paymentTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPlan {
  id: string;
  userId: string;
  sourceType: "manual" | "bill" | "import";
  sourceId?: string;
  cardId: string;
  description: string;
  categoryId: string;
  totalAmount: number;
  installmentCount: number;
  firstInstallmentDate: string;
  /** True only if every installment's invoice has been confirmed paid —
   * blocks destructive edits/deletes per the spec. */
  hasConsolidatedInstallments?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InstallmentStatus = "scheduled" | "billed" | "paid";

export interface Installment {
  id: string;
  userId: string;
  installmentPlanId: string;
  cardId: string;
  number: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  /** Resolved lazily from the card's cycle, cached for display/history. */
  invoicePeriodKey?: string;
  status: InstallmentStatus;
  transactionId?: string;
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
  type: CategoryApplicableType;
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

// ---------------------------------------------------------------------------
// Import pipeline
// ---------------------------------------------------------------------------

export type ImportRecordStatus = "valid" | "duplicate" | "needsReview" | "invalid";

export interface ImportBatch {
  id: string;
  userId: string;
  accountId?: string;
  cardId?: string;
  fileName: string;
  fileType: ImportSource;
  institutionCode?: string;
  periodStart?: string;
  periodEnd?: string;
  totalRecords: number;
  newRecords: number;
  duplicateRecords: number;
  ignoredRecords: number;
  reviewRecords: number;
  importedRecords: number;
  status: "completed" | "undone";
  createdAt: string;
  completedAt?: string;
}

export interface ImportMapping {
  id: string;
  userId: string;
  institutionCode?: string;
  fileType: ImportSource;
  /** A stable signature of the header row, used to auto-recognize this
   * layout again next time (e.g. normalized joined header names). */
  columnSignature: string;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  externalIdColumn?: string;
  dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";
  decimalFormat: "comma" | "dot";
  createdAt: string;
  updatedAt: string;
}

export interface CategorizationRule {
  id: string;
  userId: string;
  pattern: string;
  normalizedPattern: string;
  categoryId: string;
  transactionType?: TransactionType;
  institutionCode?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}
