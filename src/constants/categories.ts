import type { Category } from "../types/finance";

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "userId">[] = [
  { name: "Moradia", type: "expense", icon: "home", color: "#0f6466" },
  { name: "Alimentação", type: "expense", icon: "utensils", color: "#34d399" },
  { name: "Transporte", type: "expense", icon: "car", color: "#3b82f6" },
  { name: "Saúde", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Lazer", type: "expense", icon: "popcorn", color: "#8b5cf6" },
  { name: "Educação", type: "expense", icon: "graduation-cap", color: "#f59e0b" },
  { name: "Serviços", type: "expense", icon: "wrench", color: "#64748b" },
  { name: "Financeiro", type: "both", icon: "landmark", color: "#059669" },
  { name: "Outros", type: "both", icon: "ellipsis", color: "#94a3b8" },
  { name: "Salário", type: "income", icon: "banknote", color: "#10b981" },
  { name: "Freelance", type: "income", icon: "briefcase", color: "#34d399" },
  { name: "Investimentos", type: "income", icon: "trending-up", color: "#0f6466" },
];
