import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import NotificationsMenu from "./NotificationsMenu";
import UserMenu from "./UserMenu";
import { CheckBadgeIcon } from "../icons";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onOpenMenu: () => void;
  showSearch?: boolean;
}

export default function Header({ title, subtitle, actions, onOpenMenu, showSearch = true }: HeaderProps) {
  return (
    <header className="border-b border-ink-100">
      {/* Mobile header (< md): compact dark utility bar + title below. Desktop/tablet block below is untouched. */}
      <div className="md:hidden">
        <div
          className="flex items-center justify-between gap-3 bg-gradient-to-r from-petrol-800 to-brand-900 px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <span className="flex items-center gap-2 font-extrabold tracking-wide text-white">
            <CheckBadgeIcon size={22} />
            EM DIA
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsMenu variant="dark" />
            <UserMenu variant="dark" />
          </div>
        </div>
        <div className="bg-surface px-4 pb-3 pt-4">
          <h1 className="truncate text-xl font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-ink-500">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 bg-surface px-4 pb-4">{actions}</div>
        )}
      </div>

      {/* Desktop/tablet header (>= md): unchanged from the approved layout. */}
      <div className="hidden bg-surface/80 px-4 py-4 backdrop-blur sm:px-6 md:block lg:px-8">
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
                  className="w-56 rounded-lg border border-ink-100 bg-surface py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:bg-surface"
                />
              </label>
            )}
            <NotificationsMenu />
            <UserMenu />
          </div>
        </div>

        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
