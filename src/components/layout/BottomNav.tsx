import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../../constants/nav";

const MOBILE_ITEMS = NAV_ITEMS.slice(0, 5);

export default function BottomNav() {
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {MOBILE_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive ? "text-brand-600" : "text-ink-400"
            }`
          }
        >
          <item.icon size={20} />
          {item.label.split(" ")[0]}
        </NavLink>
      ))}
    </nav>
  );
}
