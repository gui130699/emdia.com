import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, LineChart, FileDown, Lightbulb, Home, Sparkles } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import IncomeExpenseChart from "../components/charts/IncomeExpenseChart";
import CategoryChart from "../components/charts/CategoryChart";
import CashFlowChart from "../components/charts/CashFlowChart";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import {
  filterByPeriod,
  sumByType,
  growthPercent,
  categoryBreakdown,
  monthlyEvolution,
  generateInsights,
} from "../services/reportService";
import { formatCurrency, formatPercent } from "../utils/currency";
import { exportToCsv, exportToPdf } from "../utils/exportData";

type PeriodOption = "this-month" | "last-month" | "3m" | "6m" | "year";

const PERIOD_LABELS: Record<PeriodOption, string> = {
  "this-month": "Este mês",
  "last-month": "Mês anterior",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  year: "Este ano",
};

function resolvePeriod(option: PeriodOption): { start: Date; end: Date; monthsBack: number } {
  const now = new Date();
  switch (option) {
    case "last-month": {
      const ref = subMonths(now, 1);
      return { start: startOfMonth(ref), end: endOfMonth(ref), monthsBack: 2 };
    }
    case "3m":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), monthsBack: 3 };
    case "6m":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now), monthsBack: 6 };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now), monthsBack: 12 };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now), monthsBack: 6 };
  }
}

export default function Reports() {
  const { onOpenMenu } = useLayoutContext();
  const { transactions, categories } = useFinanceData();
  const [period, setPeriod] = useState<PeriodOption>("this-month");

  const { start, end, monthsBack, previousStart, previousEnd } = useMemo(() => {
    const resolved = resolvePeriod(period);
    const previousLength = resolved.end.getTime() - resolved.start.getTime();
    return {
      ...resolved,
      previousStart: new Date(resolved.start.getTime() - previousLength),
      previousEnd: new Date(resolved.start.getTime() - 1),
    };
  }, [period]);

  const current = useMemo(() => filterByPeriod(transactions, start, end), [transactions, start, end]);
  const previous = useMemo(
    () => filterByPeriod(transactions, previousStart, previousEnd),
    [transactions, previousStart, previousEnd]
  );

  const currentTotals = sumByType(current);
  const previousTotals = sumByType(previous);
  const growth = growthPercent(currentTotals.balance, previousTotals.balance);

  const evolutionData = useMemo(() => monthlyEvolution(transactions, monthsBack), [transactions, monthsBack]);
  const expenseBreakdown = useMemo(() => categoryBreakdown(current, categories, "expense"), [current, categories]);
  const incomeBreakdown = useMemo(() => categoryBreakdown(current, categories, "income"), [current, categories]);

  const cashFlowData = useMemo(
    () => evolutionData.map((point) => ({ label: point.month, income: point.income, expense: point.expense, balance: point.income - point.expense })),
    [evolutionData]
  );

  const insights = useMemo(() => generateInsights(current, previous, categories), [current, previous, categories]);

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  function handleExportCsv() {
    exportToCsv(
      "relatorio.csv",
      ["Descrição", "Categoria", "Tipo", "Data", "Valor"],
      current.map((t) => [t.description, categoryName(t.categoryId), t.type === "income" ? "Receita" : "Despesa", t.date, t.amount.toFixed(2)])
    );
  }

  function handleExportPdf() {
    exportToPdf(
      "Relatorio Financeiro",
      ["Descrição", "Categoria", "Data", "Valor"],
      current.map((t) => [t.description, categoryName(t.categoryId), t.date, formatCurrency(t.amount)]),
      `${PERIOD_LABELS[period]} · Receitas: ${formatCurrency(currentTotals.income)} · Despesas: ${formatCurrency(currentTotals.expense)}`
    );
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Relatórios"
        subtitle="Analise seu desempenho financeiro em detalhes."
        actions={
          <>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodOption)}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-600"
            >
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <FileDown size={16} /> PDF
            </button>
            <button onClick={handleExportCsv} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <FileDown size={16} /> CSV
            </button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard
            icon={TrendingUp}
            iconClassName="bg-brand-50 text-brand-600"
            label="Receitas acumuladas"
            value={formatCurrency(currentTotals.income)}
            hint={`${formatPercent(growthPercent(currentTotals.income, previousTotals.income))} em relação ao período anterior`}
          />
          <SummaryCard
            icon={TrendingDown}
            iconClassName="bg-danger-500/10 text-danger-600"
            label="Despesas acumuladas"
            value={formatCurrency(currentTotals.expense)}
            hint={`${formatPercent(growthPercent(currentTotals.expense, previousTotals.expense))} em relação ao período anterior`}
          />
          <SummaryCard
            icon={PiggyBank}
            iconClassName="bg-warning-500/10 text-warning-600"
            label="Economia"
            value={formatCurrency(currentTotals.balance)}
            hint={currentTotals.income > 0 ? `${((currentTotals.balance / currentTotals.income) * 100).toFixed(0)}% da sua renda` : undefined}
          />
          <SummaryCard
            icon={LineChart}
            iconClassName="bg-brand-50 text-brand-600"
            label="Crescimento"
            value={formatPercent(growth)}
            hint="Evolução no período"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
            <h2 className="text-base font-bold text-ink-900">Evolução mensal</h2>
            <IncomeExpenseChart data={evolutionData} />
          </div>
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-ink-900">Despesas por categoria</h2>
            {expenseBreakdown.length === 0 ? (
              <EmptyState icon={Home} title="Sem despesas no período" />
            ) : (
              <CategoryChart data={expenseBreakdown} total={currentTotals.expense} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-ink-900">Receitas por categoria</h2>
            {incomeBreakdown.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Sem receitas no período" />
            ) : (
              <ul className="mt-4 space-y-3">
                {incomeBreakdown.map((item) => (
                  <li key={item.categoryId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink-700">{item.name}</span>
                      <span className="font-semibold text-ink-900">{formatCurrency(item.value)} · {item.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${item.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
            <h2 className="text-base font-bold text-ink-900">Receitas x Despesas</h2>
            {cashFlowData.length === 0 ? (
              <EmptyState icon={LineChart} title="Sem dados suficientes" />
            ) : (
              <CashFlowChart data={cashFlowData} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-500/10 text-warning-600">
              <Lightbulb size={17} />
            </span>
            <h2 className="text-base font-bold text-ink-900">Insights do período</h2>
          </div>
          {insights.length === 0 ? (
            <p className="mt-3 text-sm text-ink-400">Cadastre mais transações para receber insights personalizados.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-ink-50 p-3">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <p className="text-sm text-ink-700">{insight}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
