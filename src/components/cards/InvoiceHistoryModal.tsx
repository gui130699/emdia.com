import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import { Receipt } from "lucide-react";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { CreditCard, Invoice } from "../../types/finance";

const STATUS_CONFIG: Record<Invoice["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  open: { label: "Aberta", tone: "neutral" },
  closed: { label: "Fechada", tone: "warning" },
  paid: { label: "Paga", tone: "success" },
  partial: { label: "Paga parcialmente", tone: "warning" },
  overdue: { label: "Atrasada", tone: "danger" },
};

interface InvoiceHistoryModalProps {
  card: CreditCard | null;
  invoices: Invoice[];
  onClose: () => void;
}

export default function InvoiceHistoryModal({ card, invoices, onClose }: InvoiceHistoryModalProps) {
  if (!card) return null;
  const cardInvoices = [...invoices].filter((inv) => inv.cardId === card.id).sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  return (
    <Modal open={!!card} title={`Faturas — ${card.name}`} onClose={onClose}>
      {cardInvoices.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma fatura registrada ainda" description="Faturas pagas aparecem aqui conforme você quita cada ciclo." />
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {cardInvoices.map((inv) => {
            const status = STATUS_CONFIG[inv.status];
            return (
              <li key={inv.id} className="rounded-lg border border-ink-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                  <p className="text-sm font-medium text-ink-900">{inv.periodKey}</p>
                  <p className="text-xs text-ink-400">
                    {inv.dueDate ? `Vencimento ${formatDate(inv.dueDate)}` : "Vencimento não informado"}
                    {inv.paidAt ? ` · Paga em ${formatDate(inv.paidAt.slice(0, 10))}` : ""}
                  </p>
                  </div>
                  <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">{formatCurrency(inv.total)}</span>
                  <Badge label={status.label} tone={status.tone} />
                  </div>
                </div>
                {(inv.purchaseTotal != null || inv.installmentTotal != null || inv.chargesTotal != null) && (
                  <p className="mt-2 text-xs text-ink-500">
                    Compras {formatCurrency(inv.purchaseTotal ?? 0)} · Parcelas {formatCurrency(inv.installmentTotal ?? 0)} · Encargos/saldo anterior {formatCurrency((inv.chargesTotal ?? 0) + (inv.previousBalance ?? 0))} · Pagamentos/créditos -{formatCurrency((inv.paymentsTotal ?? 0) + (inv.creditsTotal ?? 0))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
