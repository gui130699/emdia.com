import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { transactionService } from "./transactionService";
import { accountService } from "./accountService";
import { invoiceService } from "./invoiceService";
import { installmentService } from "./installmentService";
import { categorizationRuleService } from "./categorizationRuleService";
import { normalizeDescription } from "../utils/normalizeDescription";
import { fingerprint } from "../utils/fingerprint";
import { parseOfx, type ParsedOfx } from "../utils/ofxParser";
import { parseCsv, parseCsvAmount, parseCsvDate } from "../utils/csvParser";
import { getCurrentInvoicePeriod, transactionsInPeriod, type InvoicePeriod } from "../utils/cardInvoice";
import { FALLBACK_INSTITUTIONS } from "../constants/institutions";
import type {
  AccountBill,
  Category,
  CreditCard,
  ImportBatch,
  ImportMapping,
  ImportRecordStatus,
  ImportSource,
  Installment,
  InstallmentPlan,
  Invoice,
  Transaction,
} from "../types/finance";

/** Matches an installment pattern like "3/12", "03 / 12" or "PARC 3/10"
 * embedded in a purchase description, e.g. "NOTEBOOK 03/12". */
const INSTALLMENT_PATTERN = /(\d{1,2})\s*\/\s*(\d{1,2})\b/;

const batchStore = createRepository<ImportBatch>("importBatches");
const mappingStore = createRepository<ImportMapping>("importMappings");

// ---------------------------------------------------------------------------
// Raw rows — the shape both OFX and CSV are normalized into before the
// shared classification/dedup logic runs.
// ---------------------------------------------------------------------------

export interface RawImportRow {
  date: string; // ISO yyyy-MM-dd
  description: string;
  amount: number; // always positive — sign is carried by `type`
  type: "income" | "expense";
  externalIdHint?: string; // e.g. OFX FITID, or a mapped CSV id column
  looksLikePaymentOrRefund?: boolean;
}

export interface ImportPreviewRow {
  key: string;
  date: string;
  description: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  type: "income" | "expense";
  status: ImportRecordStatus;
  statusReason?: string;
  categoryId: string;
  externalId: string;
  selected: boolean;
  suggestion?: {
    kind: "transfer" | "bill" | "invoice" | "installment_new";
    label: string;
    billId?: string;
    destinationAccountId?: string;
    invoiceCardId?: string;
    invoicePeriod?: InvoicePeriod;
    installmentCount?: number;
    installmentTotalAmount?: number;
    confirmed: boolean;
  };
  /** Set when the description matches an "N/M" installment pattern. If it
   * already lines up with an existing plan's installment, the row is a
   * duplicate (that parcela already has its own transaction) — otherwise
   * it's shown for information only, or as an installment_new suggestion
   * when it's the first parcela of a purchase we haven't seen before. */
  installmentMatch?: {
    number: number;
    total: number;
    baseDescription: string;
    existingPlanId?: string;
  };
}

export interface ImportPreview {
  fileName: string;
  fileType: ImportSource;
  institutionCode?: string;
  institutionName?: string;
  detectedAccountNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  rows: ImportPreviewRow[];
}

export interface ImportContext {
  userId: string;
  target: { accountId?: string; cardId?: string };
  existingTransactions: Transaction[];
  bills: AccountBill[];
  bankAccounts: { id: string; name: string }[];
  categories: Category[];
  cards: CreditCard[];
  invoices: Invoice[];
  installmentPlans: InstallmentPlan[];
  installments: Installment[];
}

// ---------------------------------------------------------------------------
// OFX / CSV adapters
// ---------------------------------------------------------------------------

export function findInstitutionByOfxBankId(bankId?: string) {
  if (!bankId) return undefined;
  return FALLBACK_INSTITUTIONS.find((i) => i.code === bankId || i.ispb === bankId);
}

export function ofxToRawRows(ofx: ParsedOfx): RawImportRow[] {
  return ofx.transactions.map((t) => {
    const isCredit = t.amount >= 0;
    const description = t.name || t.memo || "Movimentação";
    const normalized = normalizeDescription(description);
    const looksLikePaymentOrRefund =
      ofx.isCreditCard && isCredit && /(pagamento|pgto|estorno|credito)/.test(normalized);
    return {
      date: t.datePosted,
      description,
      amount: Math.abs(t.amount),
      type: ofx.isCreditCard ? "expense" : isCredit ? "income" : "expense",
      externalIdHint: t.fitId ? `ofx:${t.fitId}` : undefined,
      looksLikePaymentOrRefund,
    };
  });
}

export function detectCsvColumnSignature(headers: string[]): string {
  return headers.map((h) => normalizeDescription(h)).join("|");
}

export interface CsvColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  externalIdColumn?: string;
}

/** Best-effort guess at which CSV column is which, based on common
 * Portuguese/English header names. Returns partial results — the caller
 * shows a mapping UI for whatever it couldn't confidently guess. */
export function guessCsvMapping(headers: string[]): Partial<CsvColumnMapping> {
  const normalized = headers.map((h) => normalizeDescription(h));
  const find = (patterns: RegExp[]) => {
    const idx = normalized.findIndex((h) => patterns.some((p) => p.test(h)));
    return idx >= 0 ? headers[idx] : undefined;
  };
  return {
    dateColumn: find([/^data/, /^date/]),
    descriptionColumn: find([/historic/, /descri/, /lancamento/, /memo/, /description/]),
    amountColumn: find([/^valor$/, /^amount$/, /valor lancamento/]),
    creditColumn: find([/credito/, /credit\b/, /entrada/]),
    debitColumn: find([/debito/, /debit\b/, /saida/]),
    externalIdColumn: find([/^id$/, /identificador/, /codigo/]),
  };
}

export function csvRowsToRawRows(rows: string[][], mapping: CsvColumnMapping, headers: string[]): RawImportRow[] {
  const indexOf = (col?: string) => (col ? headers.indexOf(col) : -1);
  const dateIdx = indexOf(mapping.dateColumn);
  const descIdx = indexOf(mapping.descriptionColumn);
  const amountIdx = indexOf(mapping.amountColumn);
  const creditIdx = indexOf(mapping.creditColumn);
  const debitIdx = indexOf(mapping.debitColumn);
  const idIdx = indexOf(mapping.externalIdColumn);

  const result: RawImportRow[] = [];
  for (const row of rows) {
    const date = dateIdx >= 0 ? parseCsvDate(row[dateIdx] ?? "") : undefined;
    const description = descIdx >= 0 ? (row[descIdx] ?? "").trim() : "";
    if (!date || !description) continue;

    let amount: number | undefined;
    let type: "income" | "expense" | undefined;

    if (amountIdx >= 0) {
      const raw = parseCsvAmount(row[amountIdx] ?? "");
      if (raw !== undefined) {
        amount = Math.abs(raw);
        type = raw >= 0 ? "income" : "expense";
      }
    } else {
      const credit = creditIdx >= 0 ? parseCsvAmount(row[creditIdx] ?? "") : undefined;
      const debit = debitIdx >= 0 ? parseCsvAmount(row[debitIdx] ?? "") : undefined;
      if (credit) {
        amount = Math.abs(credit);
        type = "income";
      } else if (debit) {
        amount = Math.abs(debit);
        type = "expense";
      }
    }

    if (amount === undefined || !type || amount <= 0) continue;

    result.push({
      date,
      description,
      amount,
      type,
      externalIdHint: idIdx >= 0 && row[idIdx] ? `csv:${row[idIdx].trim()}` : undefined,
    });
  }
  return result;
}

export function parseCsvFile(text: string) {
  return parseCsv(text);
}

export function parseOfxFile(text: string): ParsedOfx {
  return parseOfx(text);
}

// ---------------------------------------------------------------------------
// Classification: dedup, category suggestion, bill/transfer linking
// ---------------------------------------------------------------------------

async function classifyRows(
  ctx: ImportContext,
  fileType: ImportSource,
  rawRows: RawImportRow[]
): Promise<ImportPreviewRow[]> {
  const scopedExisting = ctx.existingTransactions.filter(
    (t) => (ctx.target.accountId && t.accountId === ctx.target.accountId) || (ctx.target.cardId && t.cardId === ctx.target.cardId)
  );
  const existingExternalIds = new Set(scopedExisting.map((t) => t.externalId).filter(Boolean));
  const seenInThisBatch = new Set<string>();

  const otherAccountTransactions = ctx.target.accountId
    ? ctx.existingTransactions.filter((t) => t.accountId && t.accountId !== ctx.target.accountId && t.type !== "transfer")
    : [];

  const unpaidBills = ctx.bills.filter((b) => b.status !== "paid");

  // Currently-open invoice per credit card, used to suggest linking a
  // "PAGAMENTO CARTAO"-style statement line instead of double-counting it
  // as a generic expense. Deliberately based on *today's* cycle rather than
  // the row's date — matching a historical statement's exact past cycle
  // requires date math that's easy to get subtly wrong, and a wrong match
  // here would misattribute a real payment, so we only offer this
  // suggestion for statements imported close to when the payment happened.
  const openInvoiceByCard = ctx.target.accountId
    ? ctx.cards
        .filter((c) => c.type === "credito")
        .map((card) => {
          const period = getCurrentInvoicePeriod(card);
          const total = transactionsInPeriod(ctx.existingTransactions, card.id, period).reduce((sum, t) => sum + t.amount, 0);
          const alreadyPaid = ctx.invoices.some((inv) => inv.cardId === card.id && inv.periodKey === period.periodKey && inv.status === "paid");
          return { card, period, total, alreadyPaid };
        })
        .filter((entry) => entry.total > 0 && !entry.alreadyPaid)
    : [];

  const rows: ImportPreviewRow[] = [];

  for (const raw of rawRows) {
    const normalizedDescription = normalizeDescription(raw.description);
    const externalId =
      raw.externalIdHint ??
      `${fileType}:${fingerprint(ctx.userId, ctx.target.accountId ?? ctx.target.cardId ?? "", raw.date, raw.amount, raw.type, normalizedDescription)}`;

    let status: ImportRecordStatus = "valid";
    let statusReason: string | undefined;
    let suggestion: ImportPreviewRow["suggestion"];

    if (existingExternalIds.has(externalId) || seenInThisBatch.has(externalId)) {
      status = "duplicate";
      statusReason = "Já importada anteriormente.";
    } else if (raw.looksLikePaymentOrRefund) {
      status = "needsReview";
      statusReason = "Parece ser um pagamento ou estorno de fatura — verifique antes de importar como compra.";
    } else if (raw.type === "expense" && ctx.target.accountId) {
      const match = unpaidBills.find(
        (b) =>
          Math.abs(b.amount - raw.amount) < 0.01 &&
          (normalizedDescription.includes(normalizeDescription(b.description).split(" ")[0]) ||
            normalizeDescription(b.description).includes(normalizedDescription.split(" ")[0]))
      );
      if (match) {
        status = "needsReview";
        suggestion = {
          kind: "bill",
          billId: match.id,
          label: `Este lançamento pode corresponder à conta "${match.description}".`,
          confirmed: true,
        };
      }
    }

    if (!suggestion && raw.type === "expense" && ctx.target.accountId && /fatura|cartao|pagamento/.test(normalizedDescription)) {
      const invoiceMatch = openInvoiceByCard.find(
        (entry) =>
          Math.abs(entry.total - raw.amount) < 0.02 &&
          (normalizedDescription.includes(normalizeDescription(entry.card.name).split(" ")[0]) ||
            normalizedDescription.includes("fatura") ||
            normalizedDescription.includes("pagamento"))
      );
      if (invoiceMatch) {
        status = "needsReview";
        suggestion = {
          kind: "invoice",
          invoiceCardId: invoiceMatch.card.id,
          invoicePeriod: invoiceMatch.period,
          label: `Este lançamento pode ser o pagamento da fatura do cartão "${invoiceMatch.card.name}".`,
          confirmed: true,
        };
      }
    }

    if (!suggestion && raw.type === "expense" && ctx.target.accountId) {
      const partner = otherAccountTransactions.find(
        (t) =>
          t.type === "income" &&
          Math.abs(t.amount - raw.amount) < 0.01 &&
          Math.abs(new Date(t.date).getTime() - new Date(raw.date).getTime()) <= 2 * 24 * 60 * 60 * 1000
      );
      if (partner) {
        status = "needsReview";
        suggestion = {
          kind: "transfer",
          destinationAccountId: partner.accountId,
          label: `Possível transferência entre suas contas (${ctx.bankAccounts.find((a) => a.id === partner.accountId)?.name ?? "outra conta"}).`,
          confirmed: false,
        };
      }
    }

    let installmentMatch: ImportPreviewRow["installmentMatch"];
    if (ctx.target.cardId && status !== "duplicate") {
      const patternMatch = raw.description.match(INSTALLMENT_PATTERN);
      if (patternMatch) {
        const number = Number(patternMatch[1]);
        const total = Number(patternMatch[2]);
        if (number >= 1 && total >= 2 && number <= total) {
          const baseDescription = raw.description.replace(INSTALLMENT_PATTERN, "").replace(/\s{2,}/g, " ").trim();
          const normalizedBase = normalizeDescription(baseDescription);

          const existingPlan = ctx.installmentPlans.find(
            (p) =>
              p.cardId === ctx.target.cardId &&
              p.installmentCount === total &&
              normalizeDescription(p.description).includes(normalizedBase.split(" ")[0] ?? "")
          );
          const existingInstallment = existingPlan
            ? ctx.installments.find((i) => i.installmentPlanId === existingPlan.id && i.number === number)
            : undefined;

          if (existingInstallment?.transactionId) {
            status = "duplicate";
            statusReason = `Esta parcela (${number}/${total}) já está registrada no parcelamento "${existingPlan!.description}".`;
            installmentMatch = { number, total, baseDescription, existingPlanId: existingPlan!.id };
          } else if (number === 1 && !suggestion) {
            status = "needsReview";
            suggestion = {
              kind: "installment_new",
              label: `Esta compra parece ser a 1ª de ${total} parcelas. Criar um parcelamento?`,
              installmentCount: total,
              installmentTotalAmount: Math.round(raw.amount * total * 100) / 100,
              confirmed: false,
            };
            installmentMatch = { number, total, baseDescription };
          } else {
            installmentMatch = { number, total, baseDescription };
          }
        }
      }
    }

    seenInThisBatch.add(externalId);

    const categoryId = (await categorizationRuleService.matchCategory(ctx.userId, raw.description, raw.type)) ?? "";

    rows.push({
      key: externalId,
      date: raw.date,
      description: raw.description,
      rawDescription: raw.description,
      normalizedDescription,
      amount: raw.amount,
      type: raw.type,
      status,
      statusReason,
      categoryId,
      externalId,
      selected: status === "valid" || (status === "needsReview" && (suggestion?.kind === "bill" || suggestion?.kind === "invoice")),
      suggestion,
      installmentMatch,
    });
  }

  return rows;
}

export async function buildOfxPreview(
  ctx: ImportContext,
  fileName: string,
  ofx: ParsedOfx
): Promise<ImportPreview> {
  const institution = findInstitutionByOfxBankId(ofx.bankId);
  const rawRows = ofxToRawRows(ofx);
  const rows = await classifyRows(ctx, "ofx", rawRows);
  const dates = rawRows.map((r) => r.date).sort();
  return {
    fileName,
    fileType: "ofx",
    institutionCode: institution?.code ?? ofx.bankId,
    institutionName: institution?.name,
    detectedAccountNumber: ofx.accountId,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    rows,
  };
}

export async function buildCsvPreview(
  ctx: ImportContext,
  fileName: string,
  headers: string[],
  csvRows: string[][],
  mapping: CsvColumnMapping
): Promise<ImportPreview> {
  const rawRows = csvRowsToRawRows(csvRows, mapping, headers);
  const rows = await classifyRows(ctx, "csv", rawRows);
  const dates = rawRows.map((r) => r.date).sort();
  return {
    fileName,
    fileType: "csv",
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    rows,
  };
}

// ---------------------------------------------------------------------------
// Commit / undo
// ---------------------------------------------------------------------------

export const importService = {
  listBatches: (userId: string) => batchStore.list(userId),
  getBatch: (userId: string, id: string) => batchStore.get(userId, id),
  listMappings: (userId: string) => mappingStore.list(userId),

  async saveMapping(userId: string, mapping: Omit<ImportMapping, "id" | "userId" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const existing = (await mappingStore.list(userId)).find((m) => m.columnSignature === mapping.columnSignature);
    if (existing) {
      return mappingStore.update(userId, existing.id, { ...mapping, updatedAt: now });
    }
    const record: ImportMapping = { id: generateId(), userId, ...mapping, createdAt: now, updatedAt: now };
    return mappingStore.create(userId, record);
  },

  async commit(
    userId: string,
    target: { accountId?: string; cardId?: string },
    preview: ImportPreview,
    selectedRows: ImportPreviewRow[]
  ): Promise<ImportBatch> {
    const batchId = generateId();
    let newRecords = 0;
    let reviewRecords = 0;

    for (const row of selectedRows) {
      if (row.status === "duplicate" || row.status === "invalid") continue;

      if (row.suggestion?.kind === "bill" && row.suggestion.confirmed && row.suggestion.billId) {
        const transaction = await transactionService.create(userId, {
          type: "expense",
          description: `Pagamento — ${row.description}`,
          amount: row.amount,
          date: row.date,
          categoryId: row.categoryId,
          accountId: target.accountId ?? "",
          paymentMethod: "transferencia",
          recurring: false,
          source: "import",
          importSource: preview.fileType,
          importBatchId: batchId,
          originType: "bill",
          originId: row.suggestion.billId,
          externalId: row.externalId,
          rawDescription: row.rawDescription,
          normalizedDescription: row.normalizedDescription,
          importedAt: new Date().toISOString(),
        });
        await accountService.markPaid(userId, row.suggestion.billId, {
          paymentMethod: "transferencia",
          paidAt: row.date,
          paidAmount: row.amount,
          paidAccountId: target.accountId,
          paymentTransactionId: transaction.id,
        });
        newRecords++;
        continue;
      }

      if (row.suggestion?.kind === "invoice" && row.suggestion.confirmed && row.suggestion.invoiceCardId && row.suggestion.invoicePeriod) {
        const invoiceId = generateId();
        const transaction = await transactionService.create(userId, {
          type: "expense",
          description: `Pagamento de fatura — ${row.description}`,
          amount: row.amount,
          date: row.date,
          categoryId: "",
          accountId: target.accountId ?? "",
          cardId: row.suggestion.invoiceCardId,
          paymentMethod: "debito",
          recurring: false,
          source: "import",
          importSource: preview.fileType,
          importBatchId: batchId,
          originType: "credit_card_invoice",
          originId: invoiceId,
          externalId: row.externalId,
          rawDescription: row.rawDescription,
          normalizedDescription: row.normalizedDescription,
          importedAt: new Date().toISOString(),
        });
        await invoiceService.recordPayment(
          userId,
          row.suggestion.invoiceCardId,
          row.suggestion.invoicePeriod,
          row.amount,
          target.accountId ?? "",
          transaction.id,
          invoiceId
        );
        await installmentService.markInstallmentsPaid(
          userId,
          row.suggestion.invoiceCardId,
          row.suggestion.invoicePeriod.cycleStart,
          row.suggestion.invoicePeriod.cycleEnd
        );
        newRecords++;
        continue;
      }

      if (row.suggestion?.kind === "installment_new" && row.suggestion.confirmed && row.suggestion.installmentCount && target.cardId) {
        await installmentService.create(userId, {
          sourceType: "import",
          cardId: target.cardId,
          description: row.installmentMatch?.baseDescription || row.description,
          categoryId: row.categoryId || "",
          totalAmount: row.suggestion.installmentTotalAmount ?? row.amount * row.suggestion.installmentCount,
          installmentCount: row.suggestion.installmentCount,
          firstInstallmentDate: row.date,
          paymentMethod: "credito",
          source: "import",
          importBatchId: batchId,
        });
        newRecords++;
        continue;
      }

      if (row.suggestion?.kind === "transfer" && row.suggestion.confirmed && row.suggestion.destinationAccountId) {
        await transactionService.create(userId, {
          type: "transfer",
          description: row.description,
          amount: row.amount,
          date: row.date,
          categoryId: "",
          accountId: target.accountId ?? "",
          destinationAccountId: row.suggestion.destinationAccountId,
          transferId: generateId(),
          paymentMethod: "transferencia",
          recurring: false,
          source: "import",
          importSource: preview.fileType,
          importBatchId: batchId,
          externalId: row.externalId,
          rawDescription: row.rawDescription,
          normalizedDescription: row.normalizedDescription,
          importedAt: new Date().toISOString(),
        });
        newRecords++;
        continue;
      }

      if (row.status === "needsReview") reviewRecords++;

      await transactionService.create(userId, {
        type: target.cardId ? "expense" : row.type,
        description: row.description,
        amount: row.amount,
        date: row.date,
        categoryId: row.categoryId || "",
        accountId: target.cardId ? "" : target.accountId ?? "",
        cardId: target.cardId,
        paymentMethod: target.cardId ? "credito" : row.type === "income" ? "pix" : "debito",
        recurring: false,
        source: "import",
        importSource: preview.fileType,
        importBatchId: batchId,
        externalId: row.externalId,
        rawDescription: row.rawDescription,
        normalizedDescription: row.normalizedDescription,
        importedAt: new Date().toISOString(),
      });
      newRecords++;
    }

    const now = new Date().toISOString();
    const batch: ImportBatch = {
      id: batchId,
      userId,
      accountId: target.accountId,
      cardId: target.cardId,
      fileName: preview.fileName,
      fileType: preview.fileType,
      institutionCode: preview.institutionCode,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      totalRecords: preview.rows.length,
      newRecords,
      duplicateRecords: preview.rows.filter((r) => r.status === "duplicate").length,
      ignoredRecords: preview.rows.length - selectedRows.length,
      reviewRecords,
      importedRecords: newRecords,
      status: "completed",
      createdAt: now,
      completedAt: now,
    };
    return batchStore.create(userId, batch);
  },

  /** Undoes an import batch by removing every transaction it created, as
   * long as none of them were consolidated elsewhere (bill/invoice payments
   * already handled by their own reopen flows). Refuses otherwise so we
   * never silently erase reconciled history. */
  async undo(userId: string, batchId: string): Promise<{ ok: boolean; reason?: string }> {
    const batch = await batchStore.get(userId, batchId);
    if (!batch) return { ok: false, reason: "Importação não encontrada." };
    if (batch.status === "undone") return { ok: false, reason: "Esta importação já foi desfeita." };

    const all = await transactionService.list(userId);
    const imported = all.filter((t) => t.importBatchId === batchId);
    const consolidated = imported.filter(
      (t) => t.originType === "bill" || t.originType === "credit_card_invoice" || t.originType === "installment"
    );
    if (consolidated.length > 0) {
      return {
        ok: false,
        reason:
          "Alguns lançamentos desta importação já quitaram contas/faturas ou criaram um parcelamento — reabra o pagamento ou exclua o parcelamento correspondente antes de desfazer a importação.",
      };
    }

    for (const t of imported) {
      await transactionService.remove(userId, t.id);
    }
    await batchStore.update(userId, batchId, { status: "undone" });
    return { ok: true };
  },
};
