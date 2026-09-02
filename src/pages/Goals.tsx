import { useMemo, useState } from "react";
import { Plus, PiggyBank, Target, Flag, TrendingUp, Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { differenceInCalendarMonths, subMonths, endOfMonth } from "date-fns";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import GoalCard from "../components/goals/GoalCard";
import GoalDrawer from "../components/goals/GoalDrawer";
import ContributeModal from "../components/goals/ContributeModal";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { formatCurrency } from "../utils/currency";
import { formatAxisCurrency } from "../utils/chartFormat";
import { formatMonthLabel } from "../utils/date";
import type { FinancialGoal, GoalContribution } from "../types/finance";

export default function Goals() {
  const { onOpenMenu } = useLayoutContext();
  const { goals, deleteGoal, contributeGoal } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | undefined>();
  const [pendingDelete, setPendingDelete] = useState<FinancialGoal | null>(null);
  const [contributeTarget, setContributeTarget] = useState<{ goal: FinancialGoal; kind: GoalContribution["kind"] } | null>(null);

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const activeGoals = goals.length;
  const overallProgress = goals.length > 0
    ? (goals.reduce((sum, g) => sum + Math.min(g.currentAmount / Math.max(g.targetAmount, 1), 1), 0) / goals.length) * 100
    : 0;

  const suggestion = useMemo(() => {
    const now = new Date();
    let total = 0;
    for (const goal of goals) {
      const remaining = goal.targetAmount - goal.currentAmount;
      if (remaining <= 0) continue;
      const monthsLeft = Math.max(differenceInCalendarMonths(new Date(goal.deadline), now), 1);
      total += remaining / monthsLeft;
    }
    return total;
  }, [goals]);

  const evolutionData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));
    return months.map((month) => {
      const end = endOfMonth(month);
      const total = goals.reduce((sum, goal) => {
        const upToMonth = goal.contributions
          .filter((c) => new Date(c.date) <= end)
          .reduce((s, c) => s + (c.kind === "deposit" ? c.amount : -c.amount), 0);
        return sum + upToMonth;
      }, 0);
      return { month: formatMonthLabel(month), total: Math.max(total, 0) };
    });
  }, [goals]);

  function openNew() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteGoal(pendingDelete.id);
    show("Meta excluída.");
    setPendingDelete(null);
  }

  async function handleContribute(amount: number) {
    if (!contributeTarget) return;
    await contributeGoal(contributeTarget.goal.id, amount, contributeTarget.kind);
    show(contributeTarget.kind === "deposit" ? "Aporte registrado." : "Retirada registrada.");
    setContributeTarget(null);
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Metas financeiras"
        subtitle="Planeje seus objetivos e acompanhe sua evolução."
        actions={
          <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus size={16} /> Criar nova meta
          </button>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={PiggyBank} label="Total guardado" value={formatCurrency(totalSaved)} />
          <SummaryCard icon={Flag} iconClassName="bg-info-500/10 text-info-600" label="Meta do mês" value={formatCurrency(suggestion)} hint="Contribuição total planejada" />
          <SummaryCard icon={Target} label="Objetivos ativos" value={String(activeGoals)} />
          <SummaryCard icon={TrendingUp} iconClassName="bg-brand-50 text-brand-600" label="Progresso geral" value={`${overallProgress.toFixed(0)}%`} />
        </div>

        {goals.length === 0 ? (
          <EmptyState icon={Target} title="Nenhuma meta criada" description="Crie sua primeira meta para começar a planejar seus objetivos." actionLabel="Criar nova meta" onAction={openNew} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => { setEditing(goal); setDrawerOpen(true); }}
                  onDelete={() => setPendingDelete(goal)}
                  onContribute={() => setContributeTarget({ goal, kind: "deposit" })}
                  onWithdraw={() => setContributeTarget({ goal, kind: "withdrawal" })}
                />
              ))}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
                <h2 className="text-base font-bold text-ink-900">Evolução das economias</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={evolutionData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-100)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 10, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "var(--color-ink-100)",
                        backgroundColor: "var(--color-white)",
                        color: "var(--color-ink-900)",
                        fontSize: 13,
                      }}
                    />
                    <Line type="monotone" dataKey="total" name="Total guardado" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-500/10 text-warning-600">
                    <Lightbulb size={17} />
                  </span>
                  <h2 className="text-sm font-bold text-ink-900">Sugestão de contribuição mensal</h2>
                </div>
                <p className="mt-3 text-sm text-ink-500">Com base no prazo e valor restante das suas metas:</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">{formatCurrency(suggestion)}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
                  <li>✓ Mantém suas metas no prazo</li>
                  <li>✓ Acelera seus objetivos</li>
                  <li>✓ Garante mais tranquilidade financeira</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <GoalDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditing(undefined); }} initial={editing} />

      <ContributeModal
        goal={contributeTarget?.goal ?? null}
        kind={contributeTarget?.kind ?? null}
        onClose={() => setContributeTarget(null)}
        onConfirm={handleContribute}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir meta"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
