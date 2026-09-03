import { useState } from "react";
import { Pencil, Pause, Play, XCircle, Trash2, Repeat } from "lucide-react";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import RecurringRuleDrawer from "./RecurringRuleDrawer";
import RecurringPauseEndDialog from "./RecurringPauseEndDialog";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { RECURRING_FREQUENCY_LABELS } from "../../constants/labels";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { RecurringBillRule } from "../../types/finance";

const STATUS_CONFIG: Record<RecurringBillRule["status"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Ativa", tone: "success" },
  paused: { label: "Pausada", tone: "warning" },
  ended: { label: "Encerrada", tone: "neutral" },
};

export default function RecurringRulesSection() {
  const { recurringBillRules, bills, categories, pauseRecurringRule, reactivateRecurringRule, endRecurringRule, deleteRecurringRule } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBillRule | undefined>();
  const [pausing, setPausing] = useState<RecurringBillRule | null>(null);
  const [ending, setEnding] = useState<RecurringBillRule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringBillRule | null>(null);

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  function nextOccurrence(ruleId: string) {
    const today = new Date().toISOString().slice(0, 10);
    return bills
      .filter((b) => b.recurringRuleId === ruleId && b.status !== "paid" && b.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  }

  async function handleRemoveFuturePause() {
    if (!pausing) return;
    await pauseRecurringRule(pausing.id, true);
    show(`Recorrência "${pausing.description}" pausada — cobranças futuras não pagas removidas.`);
    setPausing(null);
  }
  async function handleKeepFuturePause() {
    if (!pausing) return;
    await pauseRecurringRule(pausing.id, false);
    show(`Recorrência "${pausing.description}" pausada.`);
    setPausing(null);
  }

  async function handleRemoveFutureEnd() {
    if (!ending) return;
    await endRecurringRule(ending.id, true);
    show(`Recorrência "${ending.description}" encerrada — cobranças futuras não pagas removidas.`);
    setEnding(null);
  }
  async function handleKeepFutureEnd() {
    if (!ending) return;
    await endRecurringRule(ending.id, false);
    show(`Recorrência "${ending.description}" encerrada.`);
    setEnding(null);
  }

  async function handleReactivate(rule: RecurringBillRule) {
    await reactivateRecurringRule(rule.id);
    show(`Recorrência "${rule.description}" reativada.`);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const result = await deleteRecurringRule(pendingDelete.id);
    if (!result.ok) {
      show(result.reason ?? "Não foi possível excluir esta recorrência.", "error");
    } else {
      show("Recorrência excluída.");
    }
    setPendingDelete(null);
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <Repeat size={17} /> Recorrências
        </h2>
        <button
          onClick={() => {
            setEditing(undefined);
            setDrawerOpen(true);
          }}
          className="rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
        >
          + Nova recorrência
        </button>
      </div>

      {recurringBillRules.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Repeat} title="Nenhuma recorrência cadastrada" description="Contas como Netflix, internet ou energia podem ser cadastradas uma vez e gerar as próximas cobranças automaticamente." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {recurringBillRules.map((rule) => {
            const status = STATUS_CONFIG[rule.status];
            const next = nextOccurrence(rule.id);
            const amount = rule.amountType === "fixed" ? rule.defaultAmount : rule.estimatedAmount ?? 0;
            return (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{rule.description}</p>
                  <p className="truncate text-xs text-ink-400">
                    {categoryName(rule.categoryId)} · {RECURRING_FREQUENCY_LABELS[rule.frequency]} ·{" "}
                    {rule.amountType === "fixed" ? formatCurrency(amount) : `~${formatCurrency(amount)} (estimado)`}
                  </p>
                  <p className="text-xs text-ink-400">
                    {next ? `Próxima cobrança: ${formatDate(next.dueDate)}` : "Sem próxima cobrança agendada"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge label={status.label} tone={status.tone} />
                  <button
                    aria-label="Editar recorrência"
                    onClick={() => {
                      setEditing(rule);
                      setDrawerOpen(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100"
                  >
                    <Pencil size={14} />
                  </button>
                  {rule.status === "active" && (
                    <button aria-label="Pausar recorrência" onClick={() => setPausing(rule)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100">
                      <Pause size={14} />
                    </button>
                  )}
                  {rule.status === "paused" && (
                    <button aria-label="Reativar recorrência" onClick={() => handleReactivate(rule)} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50">
                      <Play size={14} />
                    </button>
                  )}
                  {rule.status !== "ended" && (
                    <button aria-label="Encerrar recorrência" onClick={() => setEnding(rule)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100">
                      <XCircle size={14} />
                    </button>
                  )}
                  <button aria-label="Excluir recorrência" onClick={() => setPendingDelete(rule)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-500/10 hover:text-danger-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RecurringRuleDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(undefined);
        }}
        initial={editing}
      />

      <RecurringPauseEndDialog
        open={!!pausing}
        title="Pausar recorrência"
        message={`A recorrência "${pausing?.description}" vai parar de gerar novas cobranças. Remover também as cobranças futuras ainda não pagas?`}
        onRemoveFuture={handleRemoveFuturePause}
        onKeepFuture={handleKeepFuturePause}
        onCancel={() => setPausing(null)}
      />

      <RecurringPauseEndDialog
        open={!!ending}
        title="Encerrar recorrência"
        message={`A recorrência "${ending?.description}" será encerrada permanentemente. O histórico pago é sempre preservado. Remover também as cobranças futuras ainda não pagas?`}
        onRemoveFuture={handleRemoveFutureEnd}
        onKeepFuture={handleKeepFutureEnd}
        onCancel={() => setEnding(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir recorrência"
        message={`Tem certeza que deseja excluir a recorrência "${pendingDelete?.description}"? Isso só é possível se ela nunca teve cobranças pagas.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
