export type BankAccountKind = "corrente" | "poupanca" | "digital" | "carteira" | "outro";

export type ReconciliationStatus = "unreconciled" | "conferred" | "discrepancy" | "initial_reference";

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
  /** Legacy fallback only, used when the account has no BalanceSnapshot at
   * all (e.g. accounts created before this feature existed, or a wallet
   * the user just wants to track from zero). Whenever a snapshot exists,
   * the current balance is computed from the most recent one instead —
   * never from this field plus the account's entire transaction history. */
  initialBalance: number;
  /** The bank's own account/branch identifiers, kept so a future OFX import
   * can recognize this is the same account automatically. Always masked
   * when shown in the UI — never a credential. */
  externalBankAccountId?: string;
  externalBranchId?: string;
  /** Set after each reconciliation check (see BalanceSnapshot) so the
   * account list can show "Saldo conferido" / "Diferença encontrada". */
  reconciliationStatus?: ReconciliationStatus;
  lastReconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BalanceSnapshotSource = "manual" | "ofx" | "csv" | "reconciliation";

/** A known-good balance at a point in time, used as the base for computing
 * the account's current balance (snapshot + movements after asOfDate) —
 * far safer than assuming a single initialBalance covers the account's
 * entire history when that balance was actually reported much later. */
export interface BalanceSnapshot {
  id: string;
  userId: string;
  accountId: string;
  balance: number;
  asOfDate: string; // ISO yyyy-MM-dd
  source: BalanceSnapshotSource;
  importBatchId?: string;
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

export type TransactionSource = "manual" | "import" | "system";
export type ImportSource = "ofx" | "csv" | "xls" | "xlsx" | "qif" | "pdf";

/** What generated this transaction, for reporting/dedup/undo purposes. */
export type TransactionOriginType =
  | "bill"
  | "credit_card_invoice"
  | "installment"
  | "transfer"
  | "bank_import"
  | "card_import";

/** Marks a transaction that exists for a structural reason rather than a
 * real income/expense event — kept out of "regular" category reporting. */
export type TransactionSubtype = "balance_adjustment";

/** Classifies what a card-statement line actually represents — a purchase
 * behaves completely differently from a payment received, a refund or an
 * interest charge, and lumping them together as generic "expense" would
 * corrupt the invoice total and the reports. Only set for cardId-linked,
 * import-sourced transactions. */
export type CardEntryType =
  | "purchase"
  | "installment"
  | "credit_card_payment"
  | "refund"
  | "interest"
  | "fee"
  | "penalty"
  | "tax"
  | "cash_advance"
  | "adjustment"
  | "credit"
  | "previous_balance"
  | "unknown";

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
  transactionSubtype?: TransactionSubtype;
  /** Only set for imported card-statement lines — see CardEntryType. */
  cardEntryType?: CardEntryType;

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
  /** Set only for occurrences generated by a RecurringBillRule — links this
   * specific charge back to the rule that created it. Manually-marked
   * `recurring` bills (the older, simpler flag) have no rule and no id
   * here. */
  recurringRuleId?: string;
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
  /** Undefined means "not informed" — a very different thing from a real
   * R$0 limit. Never default this to 0 just because a source (like a card
   * statement import) didn't provide a number. */
  limit?: number;
  /** Undefined means the cycle boundaries aren't known yet — never default
   * to 5/15 just to have *a* number; callers must handle "not computable
   * yet" instead (see getCurrentInvoicePeriod). */
  closingDay?: number;
  dueDay?: number;
  /** Suggested account for paying this card's invoice. */
  accountId?: string;
  /** The bank's own card/account identifier (masked in the UI) — lets a
   * future statement import recognize this is the same card automatically. */
  externalCardAccountId?: string;
  color: string;
  /** When true, `color` overrides the institution's automatic theme —
   * priority order is: manual color > institution theme > neutral fallback. */
  useCustomColor?: boolean;
  /** Archived cards are hidden from purchase/selector pickers by default
   * but keep their full history (invoices, installments) intact and
   * reachable. Preferred over deletion whenever the card has any history. */
  archived?: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "open" | "closed" | "paid" | "partial" | "overdue";

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
  /** The bank's own printed total for this cycle, when a card-statement
   * import provided one — kept separate from `total` (computed from our
   * own purchase transactions) so a mismatch can be surfaced instead of
   * silently trusted. */
  statementBalance?: number;
  /** Populated once any payment is recorded — supports partial payments
   * without losing track of what's still owed. Full payment today always
   * sets this to 0. */
  remainingAmount?: number;
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

/** Actual user data (as opposed to UserSettings, which is app preferences) —
 * synced across devices like every other entity, never localStorage-only. */
export interface UserProfile {
  id: "current";
  fullName: string;
  /** Mirrors Firebase Auth's email for display — not editable here; email
   * changes go through Auth's own security flow, not this form. */
  email: string;
  /** Contact phone number, stored normalized (+55DDNNNNNNNNN). This is a
   * contact detail, not Firebase Phone Auth — never written to
   * auth.currentUser.phoneNumber. */
  phone?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
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

// ---------------------------------------------------------------------------
// Recurring bills
// ---------------------------------------------------------------------------

export type RecurringAmountType = "fixed" | "variable";
export type RecurringEndType = "never" | "date" | "occurrences";
export type RecurringRuleStatus = "active" | "paused" | "ended";

/** A recurrence *rule* — not a bill itself. Each real charge is its own
 * AccountBill (via recurringRuleId), generated a few months ahead at a
 * time; paying September's occurrence never touches October's. */
export interface RecurringBillRule {
  id: string;
  userId: string;
  description: string;
  categoryId: string;
  amountType: RecurringAmountType;
  /** Used for amountType="fixed" — every generated occurrence gets this
   * amount verbatim until the rule is edited. */
  defaultAmount: number;
  /** Used for amountType="variable" — occurrences are generated with this
   * as a placeholder "valor estimado"; reconciliation/import or a manual
   * edit later fills in the real amount for that specific occurrence. */
  estimatedAmount?: number;
  frequency: RecurringFrequency;
  startDate: string; // ISO yyyy-MM-dd — first occurrence's due date
  endType: RecurringEndType;
  endDate?: string;
  maxOccurrences?: number;
  /** Preferred day-of-month for monthly-ish frequencies, clamped to the
   * length of each generated month. */
  dayOfMonth?: number;
  paymentMethod?: PaymentMethod;
  accountId?: string;
  cardId?: string;
  status: RecurringRuleStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reconciliation learning
// ---------------------------------------------------------------------------

export type ReconciliationAliasTargetType = "bill" | "recurringBill" | "category" | "payee";
export type ConfidenceLevel = "high" | "medium" | "low";

/** Remembers that a bank description like "NET SERVICOS 0012398" means
 * "Internet" — learned the first time the user manually confirms a match,
 * then boosts confidence for every future import with the same
 * description, even across amount/date changes for variable bills. */
export interface ReconciliationAlias {
  id: string;
  userId: string;
  targetType: ReconciliationAliasTargetType;
  targetId?: string;
  recurringRuleId?: string;
  rawBankDescription: string;
  normalizedBankDescription: string;
  institutionCode?: string;
  accountId?: string;
  matchCount: number;
  lastMatchedAt: string;
  createdAt: string;
  updatedAt: string;
}
