import { useMemo, useState } from "react";
import { Plus, Wallet, CreditCard as CardIcon, Receipt, Calendar, CreditCard, Repeat, Upload, ChevronDown, ArchiveRestore } from "lucide-react";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import CategoryChart from "../components/charts/CategoryChart";
import CardDrawer from "../components/cards/CardDrawer";
import CardCarousel from "../components/cards/CardCarousel";
import CardsSummaryTable from "../components/cards/CardsSummaryTable";
import InvoicePaymentModal from "../components/cards/InvoicePaymentModal";
import InvoiceHistoryModal from "../components/cards/InvoiceHistoryModal";
import InstallmentPlansSection from "../components/cards/InstallmentPlansSection";
import ImportWizard from "../components/imports/ImportWizard";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { getCurrentInvoicePeriod, transactionsInPeriod, signedCardAmount } from "../utils/cardInvoice";
import { cardConsumptionBreakdown, cardStatementSummary } from "../services/reportService";
import { formatCurrency } from "../utils/currency";
import { formatDate, formatDateObj } from "../utils/date";
import type { CreditCard as CreditCardType } from "../types/finance";

export default function Cards() {
  const { onOpenMenu } = useLayoutContext();
  const { cards, transactions, categories, invoices, reopenInvoice, deleteInvoice, archiveCard, reactivateCard, deleteCard } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | undefined>();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [pendingReopenInvoiceId, setPendingReopenInvoiceId] = useState<string | null>(null);
  const [pendingDeleteInvoiceId, setPendingDeleteInvoiceId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [invoiceHistoryCard, setInvoiceHistoryCard] = useState<CreditCardType | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CreditCardType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CreditCardType | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<{ card: CreditCardType; reason: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const creditCards = cards.filter((c) => c.type === "credito" && !c.archived);
  const archivedCards = cards.filter((c) => c.type === "credito" && c.archived);
  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? creditCards[0];

  const invoicesByCard = useMemo(() => {
    return creditCards.map((card) => {
      const period = getCurrentInvoicePeriod(card);
      if (!period) {
        const record = invoices
          .filter((invoice) => invoice.cardId === card.id)
          .sort((left, right) => right.periodKey.localeCompare(left.periodKey))[0];
        // Closing/due day not informed yet (typically a card created from a
        // statement import) — there's no cycle to compute a "fatura atual"
        // from, so say so instead of pretending a R$0 invoice.
        return {
          card,
          period: undefined,
          purchases: [],
          total: record?.total ?? 0,
          paid: record?.status === "paid",
          partial: record?.status === "partial",
          paidAmount: record?.paidAmount,
          remainingAmount: record?.remainingAmount,
          invoiceId: record?.id,
          statementBalance: record?.statementBalance,
          statementRecord: record,
          needsSetup: true,
        };
      }
      const purchases = transactionsInPeriod(transactions, card.id, period);
      const total = purchases.reduce((sum, t) => sum + signedCardAmount(t), 0);
      const record = invoices.find((inv) => inv.cardId === card.id && inv.periodKey === period.periodKey);
      const paid = record?.status === "paid";
      const partial = record?.status === "partial";
      return {
        card,
        period,
        purchases,
        total: paid || partial ? record!.total : total,
        paid,
        partial,
        paidAmount: record?.paidAmount,
        remainingAmount: record?.remainingAmount,
        invoiceId: record?.id,
        statementBalance: record?.statementBalance,
        statementRecord: record,
        needsSetup: false,
      };
    });
  }, [creditCards, transactions, invoices]);

  // A card with no informed limit can't contribute a meaningful number to
  // these totals — treating "unknown" as 0 would silently understate the
  // real limit and (once purchases exist) show a false negative "disponível".
  const hasUnknownLimit = creditCards.some((c) => c.limit == null);
  const totalLimit = creditCards.reduce((sum, c) => sum + (c.limit ?? 0), 0);
  const totalUsed = invoicesByCard.reduce((sum, i) => sum + i.total, 0);
  const totalAvailable = hasUnknownLimit ? undefined : totalLimit - totalUsed;

  const activeInvoice = invoicesByCard.find((i) => i.card.id === selectedCard?.id);

  const recentPurchases = useMemo(
    () => [...transactions].filter((t) => t.cardId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [transactions]
  );

  const categoryData = useMemo(
    () => activeInvoice
      ? cardConsumptionBreakdown(activeInvoice.purchases, categories, activeInvoice.card.id)
      : [],
    [activeInvoice, categories]
  );
  const consumptionTotal = useMemo(() => categoryData.reduce((sum, item) => sum + item.value, 0), [categoryData]);
  const statementSummary = activeInvoice ? cardStatementSummary(activeInvoice.purchases) : null;

  async function handleReopenInvoice() {
    if (!pendingReopenInvoiceId) return;
    await reopenInvoice(pendingReopenInvoiceId);
    show("Pagamento da fatura revertido.");
    setPendingReopenInvoiceId(null);
  }

  async function handleDeleteInvoice() {
    if (!pendingDeleteInvoiceId) return;
    const result = await deleteInvoice(pendingDeleteInvoiceId);
    if (!result.ok) {
      show(result.reason ?? "Não foi possível excluir esta fatura.", "error");
    } else {
      show("Registro da fatura excluído. As compras do ciclo continuam na sua lista de transações.");
    }
    setPendingDeleteInvoiceId(null);
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  async function handleConfirmArchive() {
    if (!pendingArchive) return;
    await archiveCard(pendingArchive.id);
    show(`Cartão "${pendingArchive.name}" arquivado.`);
    setPendingArchive(null);
  }

  async function handleReactivate(card: CreditCardType) {
    await reactivateCard(card.id);
    show(`Cartão "${card.name}" reativado.`);
  }

  async function handleRequestDelete(card: CreditCardType) {
    setPendingDelete(card);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const result = await deleteCard(pendingDelete.id);
    if (!result.ok) {
      setBlockedDelete({ card: pendingDelete, reason: result.reason ?? "Este cartão possui histórico vinculado." });
    } else {
      show(`Cartão "${pendingDelete.name}" excluído.`);
    }
    setPendingDelete(null);
  }

  async function handleArchiveInsteadOfDelete() {
    if (!blockedDelete) return;
    await archiveCard(blockedDelete.card.id);
    show(`Cartão "${blockedDelete.card.name}" arquivado.`);
    setBlockedDelete(null);
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Cartões"
        subtitle="Acompanhe seus cartões e faturas."
        actions={
          <>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} /> Adicionar cartão
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-100 bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              <Upload size={16} /> Importar fatura
            </button>
          </>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard
            icon={Wallet}
            label="Limite total"
            value={hasUnknownLimit ? "Não informado" : formatCurrency(totalLimit)}
            hint={hasUnknownLimit ? "Um ou mais cartões sem limite informado" : undefined}
          />
          <SummaryCard
            icon={CardIcon}
            iconClassName="bg-brand-50 text-brand-600"
            label="Disponível"
            value={totalAvailable === undefined ? "Não disponível" : formatCurrency(totalAvailable)}
          />
          <SummaryCard
            icon={Receipt}
            iconClassName="bg-danger-500/10 text-danger-600"
            label="Fatura atual"
            value={activeInvoice?.needsSetup
              ? activeInvoice.statementBalance != null ? formatCurrency(activeInvoice.statementBalance) : "Não calculada"
              : activeInvoice ? formatCurrency(activeInvoice.total) : formatCurrency(0)}
          />
          <SummaryCard
            icon={Calendar}
            label="Fechamento"
            value={selectedCard?.closingDay != null ? `Dia ${selectedCard.closingDay}` : "Não informado"}
          />
        </div>

        {creditCards.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nenhum cartão cadastrado" description="Adicione seu primeiro cartão para acompanhar faturas e limites." actionLabel="Adicionar cartão" onAction={() => setDrawerOpen(true)} />
        ) : (
          <>
            <CardCarousel
              cards={creditCards}
              selectedId={selectedCard?.id}
              onSelect={setSelectedCardId}
              onEdit={(card) => {
                setEditingCard(card);
                setDrawerOpen(true);
              }}
              onViewDetails={(card) => setSelectedCardId(card.id)}
              onViewInvoices={(card) => setInvoiceHistoryCard(card)}
              onViewInstallments={(card) => {
                setSelectedCardId(card.id);
                document.getElementById("installment-plans-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              onArchive={(card) => setPendingArchive(card)}
              onReactivate={handleReactivate}
              onDelete={handleRequestDelete}
            />

            {activeInvoice?.needsSetup && (
              <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
                <h2 className="text-base font-bold text-ink-900">Fatura atual — {activeInvoice.card.name}</h2>
                <p className="mt-2 text-sm text-ink-500">
                  Este cartão ainda não tem dia de fechamento e vencimento definidos, então não é possível calcular a
                  fatura atual.
                </p>
                {activeInvoice.statementRecord && (
                  <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm">
                    <p className="font-semibold text-ink-900">
                      Última posição importada: {formatCurrency(activeInvoice.statementRecord.statementBalance ?? activeInvoice.statementRecord.total)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-500">
                      <span>Compras</span><span className="text-right">{formatCurrency(activeInvoice.statementRecord.purchaseTotal ?? 0)}</span>
                      <span>Parcelas</span><span className="text-right">{formatCurrency(activeInvoice.statementRecord.installmentTotal ?? 0)}</span>
                      <span>Encargos/saldo anterior</span><span className="text-right">{formatCurrency((activeInvoice.statementRecord.chargesTotal ?? 0) + (activeInvoice.statementRecord.previousBalance ?? 0))}</span>
                      <span>Pagamentos/créditos</span><span className="text-right">-{formatCurrency((activeInvoice.statementRecord.paymentsTotal ?? 0) + (activeInvoice.statementRecord.creditsTotal ?? 0))}</span>
                    </div>
                  </div>
                )}
                {activeInvoice.card.availableCredit != null && (
                  <p className="mt-3 text-xs text-ink-500">Crédito disponível informado pelo banco: {formatCurrency(activeInvoice.card.availableCredit)}</p>
                )}
                {activeInvoice.invoiceId && !activeInvoice.paid && !activeInvoice.partial && (
                  <button
                    onClick={() => setPendingDeleteInvoiceId(activeInvoice.invoiceId ?? null)}
                    className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-500/10"
                  >
                    Excluir fatura
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingCard(activeInvoice.card);
                    setDrawerOpen(true);
                  }}
                  className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Definir fechamento e vencimento
                </button>
              </div>
            )}

            {activeInvoice && !activeInvoice.needsSetup && activeInvoice.period && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
                  <h2 className="text-base font-bold text-ink-900">Fatura atual — {activeInvoice.card.name}</h2>
                  <p className="mt-1 text-2xl font-bold text-danger-600">{formatCurrency(activeInvoice.total)}</p>
                  <p className="text-xs text-ink-400">
                    Vencimento {formatDateObj(activeInvoice.period.dueDate)}
                  </p>
                  {activeInvoice.statementBalance != null && Math.abs(activeInvoice.statementBalance - activeInvoice.total) >= 0.01 && (
                    <p className="mt-1 text-xs text-warning-600">
                      Posição informada pelo banco: {formatCurrency(activeInvoice.statementBalance)} — pode haver uma
                      linha do extrato não importada.
                    </p>
                  )}
                  {activeInvoice.card.availableCredit != null && (
                    <p className="mt-1 text-xs text-ink-500">Crédito disponível informado pelo banco: {formatCurrency(activeInvoice.card.availableCredit)}</p>
                  )}
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-ink-500">
                      <span>Limite utilizado</span>
                      <span>
                        {activeInvoice.card.limit == null
                          ? "Não informado"
                          : `${activeInvoice.card.limit > 0 ? Math.round((activeInvoice.total / activeInvoice.card.limit) * 100) : 0}%`}
                      </span>
                    </div>
                    <ProgressBar
                      percent={
                        activeInvoice.card.limit != null && activeInvoice.card.limit > 0
                          ? (activeInvoice.total / activeInvoice.card.limit) * 100
                          : 0
                      }
                      colorClassName="bg-danger-500"
                    />
                  </div>
                  {activeInvoice.paid ? (
                    <button
                      onClick={() => setPendingReopenInvoiceId(activeInvoice.invoiceId ?? null)}
                      className="mt-4 w-full rounded-lg border border-ink-100 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50"
                    >
                      Fatura paga · Reabrir pagamento
                    </button>
                  ) : activeInvoice.partial ? (
                    <>
                      <p className="mt-3 text-xs text-warning-600">
                        Pago parcialmente: {formatCurrency(activeInvoice.paidAmount ?? 0)} · Restante:{" "}
                        {formatCurrency(activeInvoice.remainingAmount ?? 0)}
                      </p>
                      <button
                        onClick={() => setPayingInvoice(true)}
                        className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Pagar restante
                      </button>
                      <button
                        onClick={() => setPendingReopenInvoiceId(activeInvoice.invoiceId ?? null)}
                        className="mt-2 w-full rounded-lg border border-ink-100 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50"
                      >
                        Desfazer pagamentos
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPayingInvoice(true)}
                      disabled={activeInvoice.total <= 0}
                      className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Pagar fatura
                    </button>
                  )}
                  {activeInvoice.invoiceId && !activeInvoice.paid && !activeInvoice.partial && (
                    <button
                      onClick={() => setPendingDeleteInvoiceId(activeInvoice.invoiceId ?? null)}
                      className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-danger-600 hover:bg-danger-500/10"
                    >
                      Excluir fatura
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
                  <h2 className="text-base font-bold text-ink-900">Consumo por categoria (compras e parcelas do ciclo)</h2>
                  {categoryData.length === 0 ? (
                    <EmptyState icon={Receipt} title="Sem compras nesta fatura" />
                  ) : (
                    <CategoryChart data={categoryData} total={consumptionTotal} />
                  )}
                </div>

                {statementSummary &&
                  (statementSummary.charges > 0 || statementSummary.refunds > 0 || statementSummary.previousBalance > 0) && (
                    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-3">
                      <h2 className="text-base font-bold text-ink-900">Composição da fatura</h2>
                      <p className="mt-1 text-xs text-ink-400">
                        A fatura não é só consumo — separa o que é compra nova do que é encargo, saldo anterior ou
                        estorno, para não confundir os dois totais acima.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-ink-50 p-3">
                          <p className="text-xs text-ink-400">Consumo do ciclo</p>
                          <p className="mt-0.5 text-sm font-semibold text-ink-900">{formatCurrency(consumptionTotal)}</p>
                        </div>
                        {statementSummary.previousBalance > 0 && (
                          <div className="rounded-xl bg-ink-50 p-3">
                            <p className="text-xs text-ink-400">Saldo anterior</p>
                            <p className="mt-0.5 text-sm font-semibold text-ink-900">{formatCurrency(statementSummary.previousBalance)}</p>
                          </div>
                        )}
                        {statementSummary.charges > 0 && (
                          <div className="rounded-xl bg-ink-50 p-3">
                            <p className="text-xs text-ink-400">Encargos (juros, IOF, multa)</p>
                            <p className="mt-0.5 text-sm font-semibold text-danger-600">{formatCurrency(statementSummary.charges)}</p>
                          </div>
                        )}
                        {statementSummary.refunds > 0 && (
                          <div className="rounded-xl bg-ink-50 p-3">
                            <p className="text-xs text-ink-400">Estornos e créditos</p>
                            <p className="mt-0.5 text-sm font-semibold text-success-600">-{formatCurrency(statementSummary.refunds)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h2 className="text-base font-bold text-ink-900">Compras recentes</h2>
              {recentPurchases.length === 0 ? (
                <EmptyState icon={Receipt} title="Nenhuma compra no cartão ainda" />
              ) : (
                <ul className="mt-3 divide-y divide-ink-100">
                  {recentPurchases.map((t) => {
                    const isCredit = t.cardEntryType === "refund" || t.cardEntryType === "credit" || t.cardEntryType === "credit_card_payment";
                    return (
                      <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-ink-900">{t.description}</p>
                          <p className="text-xs text-ink-400">{categoryName(t.categoryId)} · {formatDate(t.date)}</p>
                        </div>
                        <span className={`font-semibold ${isCredit ? "text-success-600" : "text-danger-600"}`}>
                          {isCredit ? "+ " : "- "}{formatCurrency(t.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div id="installment-plans-section" className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                <Repeat size={17} /> Parcelamentos
              </h2>
              <div className="mt-3">
                <InstallmentPlansSection />
              </div>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h2 className="text-base font-bold text-ink-900">Resumo dos cartões</h2>
              <div className="mt-3">
                <CardsSummaryTable rows={invoicesByCard} />
              </div>
            </div>
          </>
        )}

        {archivedCards.length > 0 && (
          <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
            <button onClick={() => setShowArchived((v) => !v)} className="flex w-full items-center justify-between text-left">
              <h2 className="text-base font-bold text-ink-900">Cartões arquivados ({archivedCards.length})</h2>
              <ChevronDown size={16} className={`text-ink-400 transition-transform ${showArchived ? "rotate-180" : ""}`} />
            </button>
            {showArchived && (
              <ul className="mt-3 divide-y divide-ink-100">
                {archivedCards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{card.name}</p>
                      <p className="text-xs text-ink-400">•••• {card.lastFourDigits}</p>
                    </div>
                    <button
                      onClick={() => handleReactivate(card)}
                      className="flex items-center gap-1.5 rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                    >
                      <ArchiveRestore size={13} /> Reativar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <CardDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingCard(undefined);
        }}
        initial={editingCard}
      />

      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} mode="card" />

      <InvoicePaymentModal
        card={payingInvoice ? (activeInvoice?.card ?? null) : null}
        period={payingInvoice ? (activeInvoice?.period ?? null) : null}
        total={activeInvoice?.total ?? 0}
        remainingAmount={activeInvoice?.partial ? activeInvoice.remainingAmount : undefined}
        onClose={() => setPayingInvoice(false)}
      />

      <ConfirmDialog
        open={!!pendingReopenInvoiceId}
        title="Reabrir pagamento da fatura"
        message="Este pagamento será desfeito e o saldo da conta usada será restaurado. As compras e parcelamentos não serão apagados. Deseja continuar?"
        confirmLabel="Reabrir"
        onConfirm={handleReopenInvoice}
        onCancel={() => setPendingReopenInvoiceId(null)}
      />

      <ConfirmDialog
        open={!!pendingDeleteInvoiceId}
        title="Excluir fatura"
        message="O registro da fatura será removido. As compras, parcelas e outros lançamentos do ciclo continuam na sua lista de transações e a fatura pode voltar a ser calculada automaticamente a partir deles."
        confirmLabel="Excluir"
        onConfirm={handleDeleteInvoice}
        onCancel={() => setPendingDeleteInvoiceId(null)}
      />

      <InvoiceHistoryModal card={invoiceHistoryCard} invoices={invoices} onClose={() => setInvoiceHistoryCard(null)} />

      <ConfirmDialog
        open={!!pendingArchive}
        title="Arquivar cartão"
        message={`O cartão "${pendingArchive?.name}" deixará de aparecer nos seletores de novas compras, mas seu histórico continua disponível. Deseja continuar?`}
        confirmLabel="Arquivar"
        onConfirm={handleConfirmArchive}
        onCancel={() => setPendingArchive(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir cartão"
        message={`Tem certeza que deseja excluir "${pendingDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={!!blockedDelete}
        title="Este cartão possui histórico"
        message={`${blockedDelete?.reason ?? ""} Prefira arquivar o cartão para preservar o histórico.`}
        confirmLabel="Arquivar cartão"
        onConfirm={handleArchiveInsteadOfDelete}
        onCancel={() => setBlockedDelete(null)}
      />
    </>
  );
}
