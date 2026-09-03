import { useNavigate } from "react-router-dom";
import { CreditCard, BarChart3, Settings, X, ChevronRight } from "lucide-react";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const ITEMS = [
  { label: "Cartões", description: "Faturas e limites", path: "/cartoes", icon: CreditCard },
  { label: "Relatórios", description: "Análises e insights", path: "/relatorios", icon: BarChart3 },
  { label: "Configurações", description: "Perfil e preferências", path: "/configuracoes", icon: Settings },
];

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-base font-bold text-ink-900">Mais opções</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-2 px-3 pb-2">
          {ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
              className="flex w-full min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">{item.label}</span>
                <span className="block truncate text-xs text-ink-400">{item.description}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
