import { useMemo, useState } from "react";
import { Plus, CheckCircle2, FileText, Clock, AlertTriangle, Landmark } from "lucide-react";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Modal from "../components/ui/Modal";
import AccountDrawer from "../components/accounts/AccountDrawer";
import BillCalendar from "../components/accounts/BillCalendar";
import AccountsTable from "../components/accounts/AccountsTable";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { formatCurrency } from "../utils/currency";
import { daysUntil, formatDate, toMonthKey } from "../utils/date";
import type { AccountBill } from "../types/finance";

export default function Accounts() {
  const { onOpenMenu } = useLayoutContext();
  const { bills, categories, markBillPaid, deleteBill } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AccountBill | undefined>();
  const [pendingDelete, setPendingDelete] = useState<AccountBill | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const currentMonthKey = toMonthKey(new Date());
  const monthBills = useMemo(
    () => bills.filter((b) => b.dueDate.slice(0, 7) === currentMonthKey),
    [bills, currentMonthKey]
  );
  const paidCount = monthBills.filter((b) => b.status === "paid").length;
  const upcomingCount = bills.filter((b) => b.status === "upcoming").length;
  const overdueCount = bills.filter((b) => b.status === "overdue").length;

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [bills]
  );
  const upcomingList = sortedBills.filter((b) => b.status !== "paid").slice(0, 6);
  const unpaid = sortedBills.filter((b) => b.status !== "paid");

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  function openNew() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  async function handlePay(bill: AccountBill) {
    await markBillPaid(bill.id);
    show(`Conta "${bill.description}" marcada como paga.`);
    setPayModalOpen(false);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteBill(pendingDelete.id);
    show("Conta excluída.");
    setPendingDelete(null);
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Contas"
        subtitle="Gerencie contas, vencimentos e pagamentos."
        actions={
          <>
            <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Plus size={16} /> Adicionar conta
            </button>
            <button onClick={() => setPayModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              <CheckCircle2 size={16} /> Pagar conta
            </button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard icon={FileText} label="Contas do mês" value={String(monthBills.length)} />
          <SummaryCard icon={CheckCircle2} iconClassName="bg-brand-50 text-brand-600" label="Pagas" value={String(paidCount)} />
          <SummaryCard icon={Clock} iconClassName="bg-warning-500/10 text-warning-600" label="A vencer" value={String(upcomingCount)} />
          <SummaryCard icon={AlertTriangle} iconClassName="bg-danger-500/10 text-danger-600" label="Atrasadas" value={String(overdueCount)} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
            <h2 className="text-base font-bold text-ink-900">Todas as contas</h2>
            {sortedBills.length === 0 ? (
              <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" actionLabel="Adicionar conta" onAction={openNew} />
            ) : (
              <div className="mt-3">
                <AccountsTable
                  bills={sortedBills}
                  categoryName={categoryName}
                  onPay={handlePay}
                  onEdit={(bill) => {
                    setEditing(bill);
                    setDrawerOpen(true);
                  }}
                  onDelete={setPendingDelete}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-ink-900">Próximos vencimentos</h2>
            {upcomingList.length === 0 ? (
              <EmptyState icon={Clock} title="Nenhum vencimento próximo" />
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {upcomingList.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink-900">{bill.description}</p>
                      <p className={bill.status === "overdue" ? "text-xs text-danger-600" : "text-xs text-ink-400"}>
                        {bill.status === "overdue" ? "Atrasada" : `Vence em ${daysUntil(bill.dueDate)} dia(s)`}
                      </p>
                    </div>
                    <span className="font-semibold text-ink-900">{formatCurrency(bill.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <BillCalendar bills={bills} />
      </div>

      <AccountDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(undefined);
        }}
        initial={editing}
      />

      <Modal open={payModalOpen} title="Pagar conta" onClose={() => setPayModalOpen(false)}>
        {unpaid.length === 0 ? (
          <p className="text-sm text-ink-400">Não há contas pendentes.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {unpaid.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{bill.description}</p>
                  <p className="text-xs text-ink-400">{formatDate(bill.dueDate)} · {formatCurrency(bill.amount)}</p>
                </div>
                <button onClick={() => handlePay(bill)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                  Marcar paga
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir conta"
        message={`Tem certeza que deseja excluir "${pendingDelete?.description}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
