import { useState } from "react";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { CheckBadgeIcon } from "../icons";

export default function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-ink-100 bg-surface p-4 shadow-xl lg:bottom-4 lg:left-4 lg:translate-x-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <CheckBadgeIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Instalar EM DIA</p>
          <p className="text-xs text-ink-400">Acesse suas finanças direto da tela inicial, mesmo offline.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={promptInstall}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Download size={14} /> Instalar
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-50"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          aria-label="Fechar"
          onClick={() => setDismissed(true)}
          className="text-ink-300 hover:text-ink-500"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
