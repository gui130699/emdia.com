import { Wifi } from "lucide-react";
import BankLogo from "../institutions/BankLogo";
import { getCardTheme, themeFromCustomColor } from "../../constants/institutionCardThemes";
import type { CreditCard } from "../../types/finance";

export default function CreditCardVisual({ card }: { card: CreditCard }) {
  const theme = card.useCustomColor && card.color
    ? themeFromCustomColor(card.color)
    : getCardTheme(card.institutionCode, card.institution);

  return (
    <div
      className="flex h-44 w-full max-w-xs flex-col justify-between rounded-2xl p-5 shadow-lg"
      style={{ background: theme.gradient, color: theme.textColor }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: theme.logoTreatment === "light" ? "rgba(255,255,255,0.9)" : "transparent" }}
          >
            <BankLogo name={card.institution} code={card.institutionCode} logoUrl={card.institutionLogoUrl} size={22} />
          </span>
          <span className="truncate text-xs font-semibold uppercase tracking-wide" style={{ color: theme.mutedTextColor }}>
            {card.institution}
          </span>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
          style={{ backgroundColor: theme.badgeBgColor, color: theme.badgeTextColor }}
        >
          {card.type === "credito" ? "Crédito" : "Débito"}
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2" style={{ color: theme.mutedTextColor }}>
          <span className="h-6 w-8 rounded" style={{ backgroundColor: theme.chipColor }} />
          <Wifi size={16} aria-label="Aproximação" />
        </div>
        <p className="mt-2 font-mono text-lg tracking-widest">
          •••• •••• •••• {card.lastFourDigits}
        </p>
      </div>

      <div className="flex items-end justify-between text-xs">
        <div>
          <p style={{ color: theme.mutedTextColor }}>Cartão</p>
          <p className="font-semibold">{card.name}</p>
        </div>
      </div>
    </div>
  );
}
