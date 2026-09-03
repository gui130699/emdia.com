import { addMonths } from "date-fns";
import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { transactionService } from "./transactionService";
import { toDateInputValue } from "../utils/date";
import type { ImportSource, Installment, InstallmentPlan, PaymentMethod, Transaction } from "../types/finance";

const planStore = createRepository<InstallmentPlan>("installmentPlans");
const installmentStore = createRepository<Installment>("installments");

export interface CreateInstallmentPlanInput {
  sourceType: InstallmentPlan["sourceType"];
  sourceId?: string;
  cardId: string;
  description: string;
  categoryId: string;
  totalAmount: number;
  installmentCount: number;
  /** Date of the first parcela this call actually generates — startNumber
   * when set, otherwise parcela 1. */
  firstInstallmentDate: string;
  /** Defaults to 1. When a purchase's plan is first detected mid-sequence
   * (e.g. a statement first imported at parcela 4 of 10), only parcelas
   * startNumber..installmentCount are generated — parcelas before that were
   * never actually seen and must not be fabricated as paid or scheduled. */
  startNumber?: number;
  /** The real, observed value of one parcela (known from the imported
   * row) — used directly instead of splitting totalAmount, which matters
   * for a mid-sequence start since totalAmount there is only an estimate
   * (parcela value × count) rather than a true total. */
  installmentAmount?: number;
  paymentMethod?: PaymentMethod;
  /** Only set when the plan originates from an import — tags every
   * installment transaction so it shows up as "Importada" and rolls up
   * into that batch's undo safety checks. */
  source?: Transaction["source"];
  importBatchId?: string;
  priorInstallmentsTreatment?: "historical" | "paid";
  observedTransaction?: {
    description: string;
    rawDescription?: string;
    normalizedDescription?: string;
    externalGroupId?: string;
    externalRecordId?: string;
    postingDateTime?: string;
    importSource: ImportSource;
  };
}

export interface LinkImportedInstallmentInput {
  number: number;
  amount: number;
  date: string;
  description: string;
  rawDescription: string;
  normalizedDescription: string;
  externalGroupId?: string;
  externalRecordId: string;
  postingDateTime?: string;
  importSource: ImportSource;
  importBatchId: string;
  categoryId?: string;
}

/** Splits a total into N integer-cent installments where every parcela is
 * equal except the last, which absorbs the rounding remainder — the sum is
 * always exactly the original total, to the cent. */
function splitIntoCents(totalAmount: number, count: number): number[] {
  const totalCents = Math.round(totalAmount * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? base + remainder : base));
}

export const installmentService = {
  listPlans: (userId: string) => planStore.list(userId),
  getPlan: (userId: string, id: string) => planStore.get(userId, id),
  listInstallments: (userId: string) => installmentStore.list(userId),

  async installmentsForPlan(userId: string, planId: string): Promise<Installment[]> {
    const all = await installmentStore.list(userId);
    return all.filter((i) => i.installmentPlanId === planId).sort((a, b) => a.number - b.number);
  },

  async create(userId: string, input: CreateInstallmentPlanInput): Promise<InstallmentPlan> {
    const now = new Date().toISOString();
    const plan: InstallmentPlan = {
      id: generateId(),
      userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      cardId: input.cardId,
      description: input.description,
      categoryId: input.categoryId,
      totalAmount: input.totalAmount,
      installmentCount: input.installmentCount,
      firstInstallmentDate: input.firstInstallmentDate,
      trackingStartNumber: input.startNumber ?? 1,
      currentObservedNumber: input.sourceType === "import" ? input.startNumber ?? 1 : undefined,
      priorInstallmentsTreatment: input.startNumber && input.startNumber > 1
        ? input.priorInstallmentsTreatment ?? "historical"
        : undefined,
      totalAmountEstimated: input.sourceType === "import" && (input.startNumber ?? 1) > 1,
      createdAt: now,
      updatedAt: now,
    };
    await planStore.create(userId, plan);

    const startNumber = input.startNumber ?? 1;
    const remainingCount = input.installmentCount - startNumber + 1;
    const amountsInCents =
      input.installmentAmount != null
        ? Array.from({ length: remainingCount }, () => Math.round(input.installmentAmount! * 100))
        : splitIntoCents(input.totalAmount, input.installmentCount).slice(startNumber - 1);
    const firstDate = new Date(input.firstInstallmentDate + "T00:00:00");

    // Preserve the known sequence without inventing retroactive spending.
    // These rows carry progress context only and intentionally have no
    // transactionId.
    for (let number = 1; number < startNumber; number++) {
      const dueDate = toDateInputValue(addMonths(firstDate, number - startNumber));
      const historical: Installment = {
        id: generateId(),
        userId,
        installmentPlanId: plan.id,
        cardId: input.cardId,
        number,
        totalInstallments: input.installmentCount,
        amount: input.installmentAmount ?? input.totalAmount / input.installmentCount,
        dueDate,
        status: input.priorInstallmentsTreatment === "paid" ? "paid" : "historical",
        createdAt: now,
        updatedAt: now,
      };
      await installmentStore.create(userId, historical);
    }

    for (let i = 0; i < remainingCount; i++) {
      const number = startNumber + i;
      const dueDate = toDateInputValue(addMonths(firstDate, i));
      const amount = amountsInCents[i] / 100;

      const isObservedImport = input.sourceType === "import" && number === startNumber;
      const transaction = await transactionService.create(userId, {
        type: "expense",
        description: isObservedImport
          ? input.observedTransaction?.description ?? `${input.description} ${number}/${input.installmentCount}`
          : `${input.description} ${number}/${input.installmentCount}`,
        amount,
        date: dueDate,
        categoryId: input.categoryId,
        accountId: "",
        cardId: input.cardId,
        paymentMethod: input.paymentMethod ?? "credito",
        recurring: false,
        source: isObservedImport ? input.source ?? "import" : input.sourceType === "import" ? "system" : input.source ?? "manual",
        importSource: isObservedImport ? input.observedTransaction?.importSource : undefined,
        importBatchId: isObservedImport ? input.importBatchId : undefined,
        externalId: isObservedImport ? input.observedTransaction?.externalRecordId : undefined,
        externalRecordId: isObservedImport ? input.observedTransaction?.externalRecordId : undefined,
        externalGroupId: isObservedImport ? input.observedTransaction?.externalGroupId : undefined,
        rawDescription: isObservedImport ? input.observedTransaction?.rawDescription : undefined,
        normalizedDescription: isObservedImport ? input.observedTransaction?.normalizedDescription : undefined,
        postingDateTime: isObservedImport ? input.observedTransaction?.postingDateTime : undefined,
        importedAt: isObservedImport ? now : undefined,
        cardEntryType: "installment",
        originType: "installment",
        originId: plan.id,
        installmentPlanId: plan.id,
        installmentNumber: number,
      });

      const installment: Installment = {
        id: generateId(),
        userId,
        installmentPlanId: plan.id,
        cardId: input.cardId,
        number,
        totalInstallments: input.installmentCount,
        amount,
        dueDate,
        status: isObservedImport ? "billed" : "scheduled",
        transactionId: transaction.id,
        observedAt: isObservedImport ? now : undefined,
        importBatchId: isObservedImport ? input.importBatchId : undefined,
        externalRecordId: isObservedImport ? input.observedTransaction?.externalRecordId : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await installmentStore.create(userId, installment);
    }

    return plan;
  },

  /** Replaces a future projection with the real statement line, preserving
   * one financial Transaction for that installment. */
  async linkImportedInstallment(
    userId: string,
    planId: string,
    input: LinkImportedInstallmentInput
  ): Promise<Installment | undefined> {
    const plan = await planStore.get(userId, planId);
    if (!plan) return undefined;
    const installments = await this.installmentsForPlan(userId, planId);
    let installment = installments.find((candidate) => candidate.number === input.number);

    let transactionId = installment?.transactionId;
    if (transactionId) {
      await transactionService.update(userId, transactionId, {
        type: "expense",
        description: input.description,
        amount: input.amount,
        date: input.date,
        categoryId: input.categoryId ?? plan.categoryId,
        accountId: "",
        cardId: plan.cardId,
        paymentMethod: "credito",
        recurring: false,
        source: "import",
        importSource: input.importSource,
        importBatchId: input.importBatchId,
        externalId: input.externalRecordId,
        externalRecordId: input.externalRecordId,
        externalGroupId: input.externalGroupId,
        rawDescription: input.rawDescription,
        normalizedDescription: input.normalizedDescription,
        postingDateTime: input.postingDateTime,
        importedAt: new Date().toISOString(),
        cardEntryType: "installment",
        originType: "installment",
        originId: plan.id,
        installmentPlanId: plan.id,
        installmentNumber: input.number,
      });
    } else {
      const transaction = await transactionService.create(userId, {
        type: "expense",
        description: input.description,
        amount: input.amount,
        date: input.date,
        categoryId: input.categoryId ?? plan.categoryId,
        accountId: "",
        cardId: plan.cardId,
        paymentMethod: "credito",
        recurring: false,
        source: "import",
        importSource: input.importSource,
        importBatchId: input.importBatchId,
        externalId: input.externalRecordId,
        externalRecordId: input.externalRecordId,
        externalGroupId: input.externalGroupId,
        rawDescription: input.rawDescription,
        normalizedDescription: input.normalizedDescription,
        postingDateTime: input.postingDateTime,
        importedAt: new Date().toISOString(),
        cardEntryType: "installment",
        originType: "installment",
        originId: plan.id,
        installmentPlanId: plan.id,
        installmentNumber: input.number,
      });
      transactionId = transaction.id;
    }

    const now = new Date().toISOString();
    if (installment) {
      installment = (await installmentStore.update(userId, installment.id, {
        amount: input.amount,
        dueDate: input.date,
        status: "billed",
        transactionId,
        observedAt: now,
        importBatchId: input.importBatchId,
        externalRecordId: input.externalRecordId,
        updatedAt: now,
      })) as Installment;
    } else {
      installment = await installmentStore.create(userId, {
        id: generateId(),
        userId,
        installmentPlanId: plan.id,
        cardId: plan.cardId,
        number: input.number,
        totalInstallments: plan.installmentCount,
        amount: input.amount,
        dueDate: input.date,
        status: "billed",
        transactionId,
        observedAt: now,
        importBatchId: input.importBatchId,
        externalRecordId: input.externalRecordId,
        createdAt: now,
        updatedAt: now,
      });
    }
    await planStore.update(userId, plan.id, {
      currentObservedNumber: Math.max(plan.currentObservedNumber ?? plan.trackingStartNumber ?? 1, input.number),
      updatedAt: now,
    });
    return installment;
  },

  async update(userId: string, id: string, patch: Partial<Pick<InstallmentPlan, "description" | "categoryId">>) {
    return planStore.update(userId, id, { ...patch, updatedAt: new Date().toISOString() });
  },

  async markInstallmentsPaid(userId: string, cardId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    const all = await installmentStore.list(userId);
    const affected = all.filter((i) => {
      if (i.cardId !== cardId) return false;
      const d = new Date(i.dueDate + "T00:00:00");
      return d >= periodStart && d <= periodEnd;
    });
    for (const installment of affected) {
      await installmentStore.update(userId, installment.id, { status: "paid", updatedAt: new Date().toISOString() });
    }
  },

  async markInstallmentsUnpaid(userId: string, cardId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    const all = await installmentStore.list(userId);
    const affected = all.filter((i) => {
      if (i.cardId !== cardId) return false;
      const d = new Date(i.dueDate + "T00:00:00");
      return d >= periodStart && d <= periodEnd;
    });
    for (const installment of affected) {
      await installmentStore.update(userId, installment.id, { status: "billed", updatedAt: new Date().toISOString() });
    }
  },

  /** Deletes a whole plan (and its transactions). Refuses if any installment
   * has already been billed in a paid invoice, per the spec's rule against
   * silently erasing consolidated history. */
  async deletePlan(userId: string, planId: string): Promise<{ ok: boolean; reason?: string }> {
    const installments = await this.installmentsForPlan(userId, planId);
    if (installments.some((i) => i.status === "paid")) {
      return {
        ok: false,
        reason: "Este parcelamento já possui parcelas em faturas pagas e não pode ser excluído automaticamente.",
      };
    }
    for (const installment of installments) {
      if (installment.transactionId) await transactionService.remove(userId, installment.transactionId);
      await installmentStore.remove(userId, installment.id);
    }
    await planStore.remove(userId, planId);
    return { ok: true };
  },
};
