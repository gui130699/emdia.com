import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Plus,
  Minus,
  Receipt,
  FileDown,
  ArrowRight,
  Inbox,
} from "lucide-react";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import IncomeExpenseChart from "../components/charts/IncomeExpenseChart";
import CategoryChart from "../components/charts/CategoryChart";
import MiniSparkline from "../components/charts/MiniSparkline";
import TransactionDrawer from "../components/transactions/TransactionDrawer";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useAuth } from "../contexts/AuthContext";
import {
  categoryBreakdown,
  filterByPeriod,
  monthlyEvolution,
  sumByType,
  growthPercent,
} from "../services/reportService";
import { formatCurrency, formatPercent } from "../utils/currency";
import { daysUntil } from "../utils/date";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const PERIOD_OPTIONS = [
  { value: 3, label: "Últimos 3 meses" },
  { value: 6, label: "Últimos 6 meses" },
  { value: 12, label: "Este ano" },
];

export default function Dashboard() {
  const { onOpenMenu } = useLayoutContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { transactions, bills, goals, categories, loading, totalBalance } = useFinanceData();

  const [monthsBack, setMonthsBack] = useState(6);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<"income" | "expense">("expense");

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthTx = useMemo(
    () => filterByPeriod(transactions, thisMonthStart, thisMonthEnd),
    [transactions, thisMonthStart, thisMonthEnd]
  );
  const lastMonthTx = useMemo(
    () => filterByPeriod(transactions, lastMonthStart, lastMonthEnd),
    [transactions, lastMonthStart, lastMonthEnd]
  );

  const thisMonthTotals = sumByType(thisMonthTx);
  const lastMonthTotals = sumByType(lastMonthTx);

  const incomeGrowth = growthPercent(thisMonthTotals.income, lastMonthTotals.income);
  const expenseGrowth = growthPercent(thisMonthTotals.expense, lastMonthTotals.expense);

  const upcomingBills = useMemo(
    () =>
      bills
        .filter((b) => b.status !== "paid")
        .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate)),
    [bills]
  );
  const upcomingTotal = upcomingBills
    .filter((b) => daysUntil(b.dueDate) <= 7)
    .reduce((sum, b) => sum + b.amount, 0);

  const evolutionData = useMemo(() => monthlyEvolution(transactions, monthsBack), [transactions, monthsBack]);
  const balanceSparkline = useMemo(
    () => monthlyEvolution(transactions, 6).map((p) => p.income - p.expense),
    [transactions]
  );
  const expenseBreakdown = useMemo(
    () => categoryBreakdown(thisMonthTx, categories, "expense"),
    [thisMonthTx, categories]
  );

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [transactions]
  );

  const topGoals = goals.slice(0, 2);

  function openDrawer(type: "income" | "expense") {
    setDrawerType(type);
    setDrawerOpen(true);
  }

  const firstName = (currentUser?.displayName || "").split(" ")[0];

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title={firstName ? `Olá, ${firstName}` : "Olá, bem-vindo de volta"}
        subtitle="Aqui está o resumo da sua vida financeira."
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openDrawer("income")}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Adicionar receita
          </button>
          <button
            onClick={() => openDrawer("expense")}
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            <Minus size={16} /> Nova despesa
          </button>
          <button
            onClick={() => navigate("/contas")}
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            <Receipt size={16} /> Pagar conta
          </button>
          <button
            onClick={() => navigate("/relatorios")}
            className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            <FileDown size={16} /> Exportar relatório
          </button>
        </div>

        {/* Mobile summary layout: hero balance card + compact secondary stats. Desktop block below is unchanged. */}
        <div className="space-y-3 md:hidden">
          <div className="rounded-2xl bg-linear-to-br from-petrol-800 to-brand-900 p-5 text-white">
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              <Wallet size={16} /> Saldo total
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-2xl font-bold">{formatCurrency(totalBalance)}</span>
              {balanceSparkline.length > 1 && <MiniSparkline data={balanceSparkline} />}
            </div>
            {lastMonthTotals.income > 0 && (
              <span
                className={`mt-3 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold ${
                  incomeGrowth >= 0 ? "text-brand-200" : "text-red-200"
                }`}
              >
                {formatPercent(incomeGrowth)} em relação ao mês anterior
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              icon={TrendingUp}
              iconClassName="bg-success-50 text-success-600"
              label="Receitas do mês"
              value={formatCurrency(thisMonthTotals.income)}
            />
            <SummaryCard
              icon={TrendingDown}
              iconClassName="bg-danger-500/10 text-danger-600"
              label="Despesas do mês"
              value={formatCurrency(thisMonthTotals.expense)}
            />
          </div>

          <SummaryCard
            icon={CalendarClock}
            iconClassName="bg-warning-500/10 text-warning-600"
            label="Contas a vencer"
            value={formatCurrency(upcomingTotal)}
            hint={`${upcomingBills.filter((b) => daysUntil(b.dueDate) <= 7).length} conta(s) nos próximos 7 dias`}
          />
        </div>

        <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Wallet} label="Saldo total" value={formatCurrency(totalBalance)} />
          <SummaryCard
            icon={TrendingUp}
            iconClassName="bg-success-50 text-success-600"
            label="Receitas do mês"
            value={formatCurrency(thisMonthTotals.income)}
            hint={lastMonthTotals.income > 0 ? `${formatPercent(incomeGrowth)} em relação ao mês anterior` : undefined}
            hintClassName={incomeGrowth >= 0 ? "text-success-600" : "text-danger-600"}
          />
          <SummaryCard
            icon={TrendingDown}
            iconClassName="bg-danger-500/10 text-danger-600"
            label="Despesas do mês"
            value={formatCurrency(thisMonthTotals.expense)}
            hint={lastMonthTotals.expense > 0 ? `${formatPercent(expenseGrowth)} em relação ao mês anterior` : undefined}
            hintClassName={expenseGrowth <= 0 ? "text-success-600" : "text-danger-600"}
          />
          <SummaryCard
            icon={CalendarClock}
            iconClassName="bg-warning-500/10 text-warning-600"
            label="Contas a vencer"
            value={formatCurrency(upcomingTotal)}
            hint={`${upcomingBills.filter((b) => daysUntil(b.dueDate) <= 7).length} conta(s) nos próximos 7 dias`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-ink-900">Resumo financeiro</h2>
              <select
                value={monthsBack}
                onChange={(e) => setMonthsBack(Number(e.target.value))}
                className="rounded-lg border border-ink-100 bg-surface px-3 py-1.5 text-sm text-ink-600"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <IncomeExpenseChart data={evolutionData} />
          </div>

          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-ink-900">Gastos por categoria</h2>
            <div className="mt-4">
              {expenseBreakdown.length === 0 ? (
                <EmptyState icon={Inbox} title="Sem despesas este mês" description="Cadastre despesas para ver a distribuição por categoria." />
              ) : (
                <CategoryChart data={expenseBreakdown} total={thisMonthTotals.expense} />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Próximos vencimentos</h2>
              <button onClick={() => navigate("/contas")} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                Ver todas <ArrowRight size={14} />
              </button>
            </div>
            {upcomingBills.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nenhuma conta pendente" description="Suas próximas contas aparecerão aqui." />
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {upcomingBills.slice(0, 4).map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{bill.description}</p>
                      <p className={`text-xs ${bill.status === "overdue" ? "text-danger-600" : "text-ink-400"}`}>
                        {bill.status === "overdue" ? "Atrasada" : `Vence em ${daysUntil(bill.dueDate)} dia(s)`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink-900">{formatCurrency(bill.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Transações recentes</h2>
              <button onClick={() => navigate("/transacoes")} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                Ver todas <ArrowRight size={14} />
              </button>
            </div>
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Você ainda não possui transações."
                actionLabel="Adicionar primeira transação"
                onAction={() => openDrawer("income")}
              />
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm font-medium text-ink-900">{t.description}</p>
                    <span className={`text-sm font-semibold ${t.type === "income" ? "text-success-600" : "text-danger-600"}`}>
                      {t.type === "income" ? "+ " : "- "}
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Metas</h2>
              <button onClick={() => navigate("/metas")} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                Ver todas <ArrowRight size={14} />
              </button>
            </div>
            {topGoals.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Nenhuma meta criada" description="Crie metas para acompanhar seus objetivos." />
            ) : (
              <ul className="mt-4 space-y-4">
                {topGoals.map((goal) => {
                  const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                  return (
                    <li key={goal.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-ink-900">{goal.name}</span>
                        <span className="text-ink-400">{percent.toFixed(0)}%</span>
                      </div>
                      <p className="mb-1.5 text-xs text-ink-400">
                        {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                      </p>
                      <ProgressBar percent={percent} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {loading && <p className="text-center text-sm text-ink-400">Carregando seus dados...</p>}
      </div>

      <TransactionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} defaultType={drawerType} />
    </>
  );
}
