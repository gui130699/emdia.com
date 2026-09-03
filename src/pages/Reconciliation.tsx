import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Link2, Undo2, EyeOff, RotateCcw, Receipt, AlertCircle } from "lucide-react";
import Header from "../components/layout/Header";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../stores/ToastContext";
import { reconciliationAliasService } from "../services/reconciliationAliasService";
import {
  findBillMatchCandidates,
  confirmBillMatch,
  unlinkBillMatch,
  type BillMatchCandidate,
} from "../services/importService";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import type { AccountBill, ReconciliationAlias, Transaction } from "../types/finance";

const IGNORED_KEY = "emdia:ignoredReconciliations";

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveIgnored(ids: Set<string>) {
  try {
    localStorage.setItem(IGNORED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* private mode / storage unavailable — ignoring just won't persist across sessions */
  }
}

type TabKey = "pending" | "matched" | "ignored";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "matched", label: "Conciliadas" },
  { key: "ignored", label: "Ignoradas" },
];

export default function Reconciliation() {
  const { onOpenMenu } = useLayoutContext();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";
  const { bills, transactions, categories, reloadAll } = useFinanceData();
  const { show } = useToast();

  const [tab, setTab] = useState<TabKey>("pending");
  const [aliases, setAliases] = useState<ReconciliationAlias[]>([]);
  const [ignored, setIgnored] = useState<Set<string>>(loadIgnored);
  const [pendingUndo, setPendingUndo] = useState<AccountBill | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    reconciliationAliasService.list(userId).then(setAliases);
  }, [userId]);

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  const unpaidBills = useMemo(
    () => [...bills].filter((b) => b.status !== "paid").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [bills]
  );

  const candidatesByBill = useMemo(() => {
    const map = new Map<string, BillMatchCandidate[]>();
    for (const bill of unpaidBills) {
      map.set(bill.id, findBillMatchCandidates(bill, transactions, aliases));
    }
    return map;
  }, [unpaidBills, transactions, aliases]);

  const pendingBills = unpaidBills.filter((b) => !ignored.has(b.id));
  const ignoredBills = unpaidBills.filter((b) => ignored.has(b.id));

  const matchedBills = useMemo(() => {
    const txById = new Map(transactions.map((t) => [t.id, t]));
    return bills
      .filter((b) => b.status === "paid" && b.paymentTransactionId)
      .map((b) => ({ bill: b, transaction: txById.get(b.paymentTransactionId!) }))
      .filter((m): m is { bill: AccountBill; transaction: Transaction } => !!m.transaction && m.transaction.source === "import")
      .sort((a, b) => (b.bill.paidAt ?? "").localeCompare(a.bill.paidAt ?? ""));
  }, [bills, transactions]);

  function toggleIgnored(billId: string, value: boolean) {
    const next = new Set(ignored);
    if (value) next.add(billId);
    else next.delete(billId);
    setIgnored(next);
    saveIgnored(next);
  }

  async function handleConfirmMatch(bill: AccountBill, transaction: Transaction) {
    setBusyId(bill.id);
    try {
      await confirmBillMatch(userId, bill, transaction);
      await reloadAll();
      show(`"${bill.description}" conciliada com o lançamento importado.`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo() {
    if (!pendingUndo) return;
    setBusyId(pendingUndo.id);
    try {
      await unlinkBillMatch(userId, pendingUndo);
      await reloadAll();
      show(`Conciliação de "${pendingUndo.description}" desfeita.`);
    } finally {
      setBusyId(null);
      setPendingUndo(null);
    }
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Conciliação bancária"
        subtitle="Revise contas a pagar já vinculadas a lançamentos importados e vincule as que ainda faltam."
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${
                tab === t.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-100 bg-surface text-ink-600"
              }`}
            >
              {t.label}
              <span className="rounded-full bg-ink-100 px-1.5 text-xs text-ink-500">
                {t.key === "pending" ? pendingBills.length : t.key === "matched" ? matchedBills.length : ignoredBills.length}
              </span>
            </button>
          ))}
        </div>

        {tab === "pending" && (
          <div className="space-y-3">
            {pendingBills.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Nenhuma conta pendente de conciliação" description="Todas as contas em aberto já foram revisadas." />
            ) : (
              pendingBills.map((bill) => {
                const candidates = candidatesByBill.get(bill.id) ?? [];
                return (
                  <div key={bill.id} className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{bill.description}</p>
                        <p className="text-xs text-ink-400">
                          {categoryName(bill.categoryId)} · Vence em {formatDate(bill.dueDate)} · {formatCurrency(bill.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleIgnored(bill.id, true)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                      >
                        <EyeOff size={13} /> Ignorar
                      </button>
                    </div>

                    {candidates.length === 0 ? (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
                        <AlertCircle size={13} /> Nenhum lançamento importado corresponde a esta conta ainda.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {candidates.slice(0, 3).map(({ transaction, score, level }) => (
                          <li
                            key={transaction.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-ink-700">{transaction.rawDescription ?? transaction.description}</p>
                              <p className="text-xs text-ink-400">
                                {formatDate(transaction.date)} · {formatCurrency(transaction.amount)} ·{" "}
                                {level === "high" ? "alta confiança" : level === "medium" ? "confiança média" : "confiança baixa"}{" "}
                                ({score}%)
                              </p>
                            </div>
                            <button
                              disabled={busyId === bill.id}
                              onClick={() => handleConfirmMatch(bill, transaction)}
                              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              <Link2 size={13} /> Vincular
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "matched" && (
          <div className="space-y-3">
            {matchedBills.length === 0 ? (
              <EmptyState icon={Receipt} title="Nenhuma conta conciliada com um extrato ainda" description="Contas pagas pelo assistente de pagamento não aparecem aqui — só as vinculadas a um lançamento importado." />
            ) : (
              matchedBills.map(({ bill, transaction }) => (
                <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{bill.description}</p>
                    <p className="truncate text-xs text-ink-400">
                      Conciliada com "{transaction.rawDescription ?? transaction.description}" em{" "}
                      {bill.paidAt ? formatDate(bill.paidAt.slice(0, 10)) : "—"} · {formatCurrency(bill.paidAmount ?? bill.amount)}
                    </p>
                  </div>
                  <button
                    disabled={busyId === bill.id}
                    onClick={() => setPendingUndo(bill)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                  >
                    <Undo2 size={13} /> Desfazer conciliação
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "ignored" && (
          <div className="space-y-3">
            {ignoredBills.length === 0 ? (
              <EmptyState
                icon={EyeOff}
                title="Nenhuma conta ignorada"
                description={'Contas marcadas como "Ignorar" na aba Pendentes aparecem aqui.'}
              />
            ) : (
              ignoredBills.map((bill) => (
                <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{bill.description}</p>
                    <p className="text-xs text-ink-400">
                      {categoryName(bill.categoryId)} · Vence em {formatDate(bill.dueDate)} · {formatCurrency(bill.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleIgnored(bill.id, false)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                  >
                    <RotateCcw size={13} /> Reativar
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingUndo}
        title="Desfazer conciliação"
        message={`"${pendingUndo?.description}" voltará a aparecer como pendente. O lançamento importado não será apagado, apenas desvinculado.`}
        confirmLabel="Desfazer"
        onConfirm={handleUndo}
        onCancel={() => setPendingUndo(null)}
      />
    </>
  );
}
