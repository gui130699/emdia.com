import { useMemo, useState } from "react";
import { Plus, FileDown, ArrowDownCircle, ArrowUpCircle, Wallet2, Receipt, Upload } from "lucide-react";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import SearchInput from "../components/ui/SearchInput";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import CashFlowChart from "../components/charts/CashFlowChart";
import TransactionTable from "../components/transactions/TransactionTable";
import TransactionDrawer from "../components/transactions/TransactionDrawer";
import ImportWizard from "../components/imports/ImportWizard";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { filterByPeriod, sumByType } from "../services/reportService";
import { formatCurrency } from "../utils/currency";
import { formatDateShort, toDateInputValue } from "../utils/date";
import { PAYMENT_METHOD_LABELS } from "../constants/labels";
import { inputClass } from "../components/ui/formStyles";
import { exportToCsv, exportToPdf } from "../utils/exportData";
import type { Transaction } from "../types/finance";

type TypeFilter = "all" | "income" | "expense";

export default function Transactions() {
  const { onOpenMenu } = useLayoutContext();
  const { transactions, categories, bankAccounts, deleteTransaction, duplicateTransaction } = useFinanceData();
  const { show } = useToast();

  const now = new Date();
  const [start, setStart] = useState(toDateInputValue(startOfMonth(now)));
  const [end, setEnd] = useState(toDateInputValue(endOfMonth(now)));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | "manual" | "import">("all");
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const periodTransactions = useMemo(
    () => filterByPeriod(transactions, parseISO(start), parseISO(end)),
    [transactions, start, end]
  );

  const filtered = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter && t.categoryId !== categoryFilter) return false;
      if (accountFilter && t.accountId !== accountFilter) return false;
      if (paymentFilter && t.paymentMethod !== paymentFilter) return false;
      if (originFilter !== "all" && (t.source ?? "manual") !== originFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [periodTransactions, typeFilter, categoryFilter, accountFilter, paymentFilter, originFilter, search]);

  const totals = sumByType(filtered);

  const cashFlowData = useMemo(() => {
    const byDate = new Map<string, { income: number; expense: number }>();
    for (const t of filtered) {
      const entry = byDate.get(t.date) ?? { income: 0, expense: 0 };
      if (t.type === "income") entry.income += t.amount;
      else entry.expense += t.amount;
      byDate.set(t.date, entry);
    }
    let running = 0;
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        running += v.income - v.expense;
        return { label: formatDateShort(date), income: v.income, expense: v.expense, balance: running };
      });
  }, [filtered]);

  function openNew() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteTransaction(pendingDelete.id);
    show("Transação excluída.");
    setPendingDelete(null);
  }

  async function handleDuplicate(t: Transaction) {
    await duplicateTransaction(t.id);
    show("Transação duplicada.");
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "";
  }
  function accountName(id: string) {
    return bankAccounts.find((a) => a.id === id)?.name ?? "";
  }

  function handleExportCsv() {
    exportToCsv(
      "transacoes.csv",
      ["Descrição", "Categoria", "Conta", "Data", "Tipo", "Valor"],
      filtered.map((t) => [
        t.description,
        categoryName(t.categoryId),
        accountName(t.accountId),
        t.date,
        t.type === "income" ? "Receita" : "Despesa",
        t.amount.toFixed(2),
      ])
    );
  }

  function handleExportPdf() {
    exportToPdf(
      "Transações",
      ["Descrição", "Categoria", "Conta", "Data", "Valor"],
      filtered.map((t) => [
        t.description,
        categoryName(t.categoryId),
        accountName(t.accountId),
        t.date,
        formatCurrency(t.amount),
      ]),
      `${start} a ${end}`
    );
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Transações"
        subtitle="Acompanhe suas movimentações financeiras."
        actions={
          <>
            <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Plus size={16} /> Nova transação
            </button>
            <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <Upload size={16} /> Importar extrato
            </button>
            <button onClick={handleExportCsv} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <FileDown size={16} /> CSV
            </button>
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <FileDown size={16} /> PDF
            </button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Mobile filter bar: search + chips + compact date range. Desktop block below is unchanged. */}
        <div className="space-y-3 md:hidden">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar transação..." />

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {[
              { key: "all", label: "Todas" },
              { key: "income", label: "Receitas" },
              { key: "expense", label: "Despesas" },
              ...categories.map((c) => ({ key: c.id, label: c.name })),
            ].map((chip) => {
              const isTypeChip = chip.key === "all" || chip.key === "income" || chip.key === "expense";
              const active = isTypeChip
                ? typeFilter === chip.key && !categoryFilter
                : categoryFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => {
                    if (isTypeChip) {
                      setTypeFilter(chip.key as TypeFilter);
                      setCategoryFilter("");
                    } else {
                      setCategoryFilter(chip.key);
                      setTypeFilter("all");
                    }
                  }}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${
                    active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-100 bg-surface text-ink-600"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">De</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-500">Até</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>

        <div className="hidden flex-wrap items-end gap-3 rounded-2xl border border-ink-100 bg-surface p-4 md:flex">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-500">De</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-500">Até</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm" />
          </label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="rounded-lg border border-ink-100 px-2.5 py-2 text-sm">
            <option value="all">Todas</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-ink-100 px-2.5 py-2 text-sm">
            <option value="">Todas categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="rounded-lg border border-ink-100 px-2.5 py-2 text-sm">
            <option value="">Todas contas</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-lg border border-ink-100 px-2.5 py-2 text-sm">
            <option value="">Todas formas</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value as typeof originFilter)} className="rounded-lg border border-ink-100 px-2.5 py-2 text-sm">
            <option value="all">Todas origens</option>
            <option value="manual">Manuais</option>
            <option value="import">Importadas</option>
          </select>
          <div className="ml-auto">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar transação..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryCard icon={ArrowUpCircle} iconClassName="bg-success-50 text-success-600" label="Entradas" value={formatCurrency(totals.income)} />
          <SummaryCard icon={ArrowDownCircle} iconClassName="bg-danger-500/10 text-danger-600" label="Saídas" value={formatCurrency(totals.expense)} />
          <SummaryCard
            icon={Wallet2}
            label="Saldo do período"
            value={formatCurrency(totals.balance)}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
          <h2 className="text-base font-bold text-ink-900">Fluxo de caixa no período</h2>
          {cashFlowData.length === 0 ? (
            <EmptyState icon={Receipt} title="Sem movimentações no período" />
          ) : (
            <CashFlowChart data={cashFlowData} />
          )}
        </div>

        <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Você ainda não possui transações."
              description="Cadastre sua primeira receita ou despesa para começar a acompanhar suas finanças."
              actionLabel="Adicionar primeira transação"
              onAction={openNew}
            />
          ) : (
            <TransactionTable
              transactions={filtered}
              categories={categories}
              bankAccounts={bankAccounts}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              onDuplicate={handleDuplicate}
            />
          )}
        </div>
      </div>

      <TransactionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} initial={editing} />

      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} mode="account" />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir transação"
        message={`Tem certeza que deseja excluir "${pendingDelete?.description}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
