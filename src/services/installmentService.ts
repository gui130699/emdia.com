import { addMonths } from "date-fns";
import { createRepository } from "../db/dexieRepository";
import { generateId } from "./localStore";
import { transactionService } from "./transactionService";
import { toDateInputValue } from "../utils/date";
import type { Installment, InstallmentPlan, PaymentMethod } from "../types/finance";

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
  firstInstallmentDate: string;
  paymentMethod?: PaymentMethod;
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
      createdAt: now,
      updatedAt: now,
    };
    await planStore.create(userId, plan);

    const amountsInCents = splitIntoCents(input.totalAmount, input.installmentCount);
    const firstDate = new Date(input.firstInstallmentDate + "T00:00:00");

    for (let i = 0; i < input.installmentCount; i++) {
      const dueDate = toDateInputValue(addMonths(firstDate, i));
      const amount = amountsInCents[i] / 100;

      const transaction = await transactionService.create(userId, {
        type: "expense",
        description: `${input.description} ${i + 1}/${input.installmentCount}`,
        amount,
        date: dueDate,
        categoryId: input.categoryId,
        accountId: "",
        cardId: input.cardId,
        paymentMethod: input.paymentMethod ?? "credito",
        recurring: false,
        source: "manual",
        originType: "installment",
        originId: plan.id,
        installmentPlanId: plan.id,
        installmentNumber: i + 1,
      });

      const installment: Installment = {
        id: generateId(),
        userId,
        installmentPlanId: plan.id,
        cardId: input.cardId,
        number: i + 1,
        totalInstallments: input.installmentCount,
        amount,
        dueDate,
        status: "scheduled",
        transactionId: transaction.id,
        createdAt: now,
        updatedAt: now,
      };
      await installmentStore.create(userId, installment);
    }

    return plan;
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
