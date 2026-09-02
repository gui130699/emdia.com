import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import NotificationsMenu from "./NotificationsMenu";
import UserMenu from "./UserMenu";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onOpenMenu: () => void;
  showSearch?: boolean;
}

export default function Header({ title, subtitle, actions, onOpenMenu, showSearch = true }: HeaderProps) {
  return (
    <header className="border-b border-ink-100 bg-surface/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-50 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {showSearch && (
            <label className="relative hidden md:block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type="search"
                placeholder="Buscar..."
                aria-label="Buscar"
                className="w-56 rounded-lg border border-ink-100 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:bg-surface"
              />
            </label>
          )}
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>

      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
