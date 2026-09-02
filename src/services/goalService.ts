import { createLocalCollection, generateId } from "./localStore";
import type { FinancialGoal, GoalContribution } from "../types/finance";

const store = createLocalCollection<FinancialGoal>("goals");

export interface FinancialGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  icon: string;
  categoryId?: string;
}

export const goalService = {
  list: (userId: string) => store.list(userId),

  async create(userId: string, input: FinancialGoalInput): Promise<FinancialGoal> {
    const now = new Date().toISOString();
    const goal: FinancialGoal = {
      id: generateId(),
      userId,
      ...input,
      contributions: input.currentAmount
        ? [{ id: generateId(), amount: input.currentAmount, date: now, kind: "deposit" }]
        : [],
      createdAt: now,
      updatedAt: now,
    };
    return store.create(userId, goal);
  },

  async update(userId: string, id: string, input: Partial<FinancialGoalInput>) {
    return store.update(userId, id, { ...input, updatedAt: new Date().toISOString() });
  },

  async contribute(userId: string, id: string, amount: number, kind: GoalContribution["kind"]) {
    const goal = await store.get(userId, id);
    if (!goal) return undefined;
    const delta = kind === "deposit" ? amount : -amount;
    const contribution: GoalContribution = {
      id: generateId(),
      amount,
      kind,
      date: new Date().toISOString(),
    };
    return store.update(userId, id, {
      currentAmount: Math.max(0, goal.currentAmount + delta),
      contributions: [...goal.contributions, contribution],
      updatedAt: new Date().toISOString(),
    });
  },

  remove: (userId: string, id: string) => store.remove(userId, id),
};
