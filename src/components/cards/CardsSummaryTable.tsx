import { formatCurrency } from "../../utils/currency";
import { formatDateObj } from "../../utils/date";
import BankLogo from "../institutions/BankLogo";
import type { CreditCard } from "../../types/finance";
import type { InvoicePeriod } from "../../utils/cardInvoice";

interface CardsSummaryTableProps {
  rows: { card: CreditCard; total: number; period: InvoicePeriod }[];
}

export default function CardsSummaryTable({ rows }: CardsSummaryTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2.5 pr-3 font-medium">Cartão</th>
              <th className="py-2.5 pr-3 font-medium">Limite</th>
              <th className="py-2.5 pr-3 font-medium">Utilizado</th>
              <th className="py-2.5 pr-3 font-medium">Disponível</th>
              <th className="py-2.5 pr-3 font-medium">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ card, total, period }) => (
              <tr key={card.id} className="border-b border-ink-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-ink-900">
                  <span className="flex items-center gap-2">
                    <BankLogo name={card.institution} code={card.institutionCode} logoUrl={card.institutionLogoUrl} size={24} />
                    {card.name} •••• {card.lastFourDigits}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(card.limit)}</td>
                <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(total)}</td>
                <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(card.limit - total)}</td>
                <td className="py-2.5 pr-3 text-ink-500">{formatDateObj(period.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {rows.map(({ card, total, period }) => (
          <li key={card.id} className="rounded-xl border border-ink-100 p-4">
            <div className="flex items-center gap-2 font-medium text-ink-900">
              <BankLogo name={card.institution} code={card.institutionCode} logoUrl={card.institutionLogoUrl} size={24} />
              {card.name} •••• {card.lastFourDigits}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-ink-400">Limite</span>
              <span className="text-right font-medium text-ink-900">{formatCurrency(card.limit)}</span>
              <span className="text-ink-400">Utilizado</span>
              <span className="text-right font-medium text-ink-900">{formatCurrency(total)}</span>
              <span className="text-ink-400">Disponível</span>
              <span className="text-right font-medium text-ink-900">{formatCurrency(card.limit - total)}</span>
              <span className="text-ink-400">Vencimento</span>
              <span className="text-right font-medium text-ink-900">{formatDateObj(period.dueDate)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
