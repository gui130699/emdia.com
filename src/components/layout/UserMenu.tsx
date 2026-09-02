import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import Avatar from "./Avatar";

export default function UserMenu() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const name = currentUser?.displayName || currentUser?.email || "Usuário";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-ink-50"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Avatar name={name} />
        <ChevronDown size={16} className="text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-ink-100 bg-surface p-2 shadow-lg">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
            {currentUser?.email && (
              <p className="truncate text-xs text-ink-400">{currentUser.email}</p>
            )}
          </div>
          <hr className="my-1 border-ink-100" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/configuracoes");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            <SettingsIcon size={16} /> Configurações
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-danger-600 hover:bg-danger-500/10"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
