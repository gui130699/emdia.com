import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Repeat } from "lucide-react";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { InstallmentPlan } from "../../types/finance";

const STATUS_CONFIG = {
  historical: { label: "Anterior", tone: "neutral" as const },
  scheduled: { label: "Agendada", tone: "neutral" as const },
  billed: { label: "Na fatura", tone: "warning" as const },
  paid: { label: "Paga", tone: "success" as const },
};

export default function InstallmentPlansSection() {
  const { installmentPlans, installments, cards, deleteInstallmentPlan } = useFinanceData();
  const { show } = useToast();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InstallmentPlan | null>(null);

  async function handleDelete() {
    if (!pendingDelete) return;
    const result = await deleteInstallmentPlan(pendingDelete.id);
    if (!result.ok) {
      show(result.reason ?? "Não foi possível excluir o parcelamento.", "error");
    } else {
      show("Parcelamento excluído.");
    }
    setPendingDelete(null);
  }

  if (installmentPlans.length === 0) {
    return <EmptyState icon={Repeat} title="Nenhum parcelamento em andamento" />;
  }

  return (
    <div className="space-y-3">
      {installmentPlans.map((plan) => {
        const card = cards.find((c) => c.id === plan.cardId);
        const planInstallments = installments
          .filter((i) => i.installmentPlanId === plan.id)
          .sort((a, b) => a.number - b.number);
        const paidCount = planInstallments.filter((i) => i.status === "paid").length;
        const historicalCount = planInstallments.filter((i) => i.status === "historical").length;
        const remaining = planInstallments.filter((i) => i.status !== "paid" && i.status !== "historical");
        const nextInstallment = remaining.find((i) => i.status === "scheduled") ?? remaining[0];
        const totalRemaining = remaining.reduce((sum, i) => sum + i.amount, 0);
        const installmentAmount = planInstallments[0]?.amount ?? plan.totalAmount / plan.installmentCount;
        const isOpen = expanded === plan.id;

        return (
          <div key={plan.id} className="rounded-xl border border-ink-100">
            <button
              onClick={() => setExpanded(isOpen ? null : plan.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{plan.description}</p>
                <p className="truncate text-xs text-ink-400">
                  {card ? `${card.name} •••• ${card.lastFourDigits}` : "Cartão removido"} · {formatCurrency(plan.totalAmount)} em {plan.installmentCount}x de {formatCurrency(installmentAmount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right text-xs">
                  <p className="font-semibold text-ink-900">
                    Parcela atual {plan.currentObservedNumber ?? plan.trackingStartNumber ?? nextInstallment?.number ?? 1}/{plan.installmentCount}
                  </p>
                  <p className="text-ink-400">Restante {formatCurrency(totalRemaining)}</p>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-ink-100 p-4">
                <p className="mb-3 text-xs text-ink-500">
                  {historicalCount} anterior(es) · {remaining.length} restante(s)
                  {paidCount > 0 ? ` · ${paidCount} paga(s) confirmada(s)` : ""}
                </p>
                {nextInstallment && (
                  <p className="mb-3 text-xs text-ink-500">
                    Próxima parcela: {nextInstallment.number}/{plan.installmentCount} · {formatDate(nextInstallment.dueDate)} · {formatCurrency(nextInstallment.amount)}
                  </p>
                )}
                <ul className="divide-y divide-ink-100">
                  {planInstallments.map((i) => {
                    const status = STATUS_CONFIG[i.status];
                    return (
                      <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-ink-700">{i.number}/{plan.installmentCount} · {formatDate(i.dueDate)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-900">{formatCurrency(i.amount)}</span>
                          <Badge label={status.label} tone={status.tone} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => setPendingDelete(plan)}
                  className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-500/10"
                >
                  <Trash2 size={13} /> Excluir parcelamento
                </button>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir parcelamento"
        message={`Tem certeza que deseja excluir o parcelamento "${pendingDelete?.description}"? As parcelas ainda não faturadas serão removidas.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
