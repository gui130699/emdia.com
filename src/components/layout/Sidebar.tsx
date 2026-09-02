import { NavLink } from "react-router-dom";
import { LineChart } from "lucide-react";
import { NAV_ITEMS } from "../../constants/nav";
import { CheckBadgeIcon } from "../icons";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col px-4 py-6 text-ink-50">
      <div className="flex items-center gap-2 px-2">
        <span className="text-brand-400">
          <CheckBadgeIcon size={30} />
        </span>
        <span className="text-lg font-extrabold tracking-wide text-white">EM DIA</span>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm leading-snug text-white/80">
          Organize suas finanças com mais clareza e segurança.
        </p>
        <div className="mt-3 flex items-center gap-2 text-brand-400">
          <LineChart size={40} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col bg-gradient-to-b from-petrol-800 via-petrol-900 to-brand-900">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-petrol-800 via-petrol-900 to-brand-900 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
