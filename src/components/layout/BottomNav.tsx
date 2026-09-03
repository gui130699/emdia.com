import { NavLink, useLocation } from "react-router-dom";
import { Home, ArrowLeftRight, Landmark, Target, MoreHorizontal } from "lucide-react";

const MAIN_ITEMS = [
  { label: "Início", path: "/dashboard", icon: Home },
  { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
  { label: "Contas", path: "/contas", icon: Landmark },
  { label: "Metas", path: "/metas", icon: Target },
];

const MORE_PATHS = ["/cartoes", "/relatorios", "/importacoes", "/conciliacao", "/ajuda", "/configuracoes"];

interface BottomNavProps {
  onOpenMore: () => void;
}

export default function BottomNav({ onOpenMore }: BottomNavProps) {
  const location = useLocation();
  const moreActive = MORE_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {MAIN_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive ? "text-brand-600" : "text-ink-400"
            }`
          }
        >
          <item.icon size={21} />
          {item.label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onOpenMore}
        aria-label="Mais opções"
        className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
          moreActive ? "text-brand-600" : "text-ink-400"
        }`}
      >
        <MoreHorizontal size={21} />
        Mais
      </button>
    </nav>
  );
}
