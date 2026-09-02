import { Wifi } from "lucide-react";
import type { CreditCard } from "../../types/finance";
import { CheckBadgeIcon } from "../icons";

export default function CreditCardVisual({ card }: { card: CreditCard }) {
  return (
    <div
      className="flex h-44 w-full max-w-xs flex-col justify-between rounded-2xl p-5 text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${card.color}, #06211f)` }}
    >
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <CheckBadgeIcon size={18} /> EM DIA
        </span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold capitalize">
          {card.type === "credito" ? "Crédito" : "Débito"}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2 text-white/70">
          <span className="h-6 w-8 rounded bg-white/20" />
          <Wifi size={16} />
        </div>
        <p className="mt-2 font-mono text-lg tracking-widest">
          •••• •••• •••• {card.lastFourDigits}
        </p>
      </div>

      <div className="flex items-end justify-between text-xs">
        <div>
          <p className="text-white/60">Titular</p>
          <p className="font-semibold uppercase">{card.institution}</p>
        </div>
        <span className="text-sm font-bold italic">{card.name}</span>
      </div>
    </div>
  );
}
