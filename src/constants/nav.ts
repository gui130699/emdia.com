import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  CreditCard,
  Target,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral", path: "/dashboard", icon: LayoutDashboard },
  { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
  { label: "Contas", path: "/contas", icon: Landmark },
  { label: "Cartões", path: "/cartoes", icon: CreditCard },
  { label: "Metas", path: "/metas", icon: Target },
  { label: "Relatórios", path: "/relatorios", icon: BarChart3 },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
];
