import { useMemo, useState } from "react";
import { Plus, Wallet, CreditCard as CardIcon, Receipt, Calendar, CreditCard, Repeat } from "lucide-react";
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
import InstallmentPlansSection from "../components/cards/InstallmentPlansSection";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { getCurrentInvoicePeriod, transactionsInPeriod } from "../utils/cardInvoice";
import { categoryBreakdown } from "../services/reportService";
import { formatCurrency } from "../utils/currency";
import { formatDate, formatDateObj } from "../utils/date";

export default function Cards() {
  const { onOpenMenu } = useLayoutContext();
  const { cards, transactions, categories, invoices, reopenInvoice } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [pendingReopenInvoiceId, setPendingReopenInvoiceId] = useState<string | null>(null);

  const creditCards = cards.filter((c) => c.type === "credito");
  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? creditCards[0];

  const invoicesByCard = useMemo(() => {
    return creditCards.map((card) => {
      const period = getCurrentInvoicePeriod(card);
      const purchases = transactionsInPeriod(transactions, card.id, period);
      const total = purchases.reduce((sum, t) => sum + t.amount, 0);
      const record = invoices.find((inv) => inv.cardId === card.id && inv.periodKey === period.periodKey);
      const paid = record?.status === "paid";
      return { card, period, purchases, total: paid ? record!.total : total, paid, invoiceId: record?.id };
    });
  }, [creditCards, transactions, invoices]);

  const totalLimit = creditCards.reduce((sum, c) => sum + c.limit, 0);
  const totalUsed = invoicesByCard.reduce((sum, i) => sum + i.total, 0);
  const totalAvailable = totalLimit - totalUsed;

  const activeInvoice = invoicesByCard.find((i) => i.card.id === selectedCard?.id);

  const recentPurchases = useMemo(
    () => [...transactions].filter((t) => t.cardId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [transactions]
  );

  const categoryData = activeInvoice
    ? categoryBreakdown(activeInvoice.purchases, categories, "expense")
    : [];

  async function handleReopenInvoice() {
    if (!pendingReopenInvoiceId) return;
    await reopenInvoice(pendingReopenInvoiceId);
    show("Pagamento da fatura revertido.");
    setPendingReopenInvoiceId(null);
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Outros";
  }

  return (
    <>
      <Header
        onOpenMenu={onOpenMenu}
        title="Cartões"
        subtitle="Acompanhe seus cartões e faturas."
        actions={
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Adicionar cartão
          </button>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard icon={Wallet} label="Limite total" value={formatCurrency(totalLimit)} />
          <SummaryCard icon={CardIcon} iconClassName="bg-brand-50 text-brand-600" label="Disponível" value={formatCurrency(totalAvailable)} />
          <SummaryCard
            icon={Receipt}
            iconClassName="bg-danger-500/10 text-danger-600"
            label="Fatura atual"
            value={activeInvoice ? formatCurrency(activeInvoice.total) : formatCurrency(0)}
          />
          <SummaryCard
            icon={Calendar}
            label="Fechamento"
            value={selectedCard ? `Dia ${selectedCard.closingDay}` : "—"}
          />
        </div>

        {creditCards.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nenhum cartão cadastrado" description="Adicione seu primeiro cartão para acompanhar faturas e limites." actionLabel="Adicionar cartão" onAction={() => setDrawerOpen(true)} />
        ) : (
          <>
            <CardCarousel cards={creditCards} selectedId={selectedCard?.id} onSelect={setSelectedCardId} />

            {activeInvoice && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
                  <h2 className="text-base font-bold text-ink-900">Fatura atual — {activeInvoice.card.name}</h2>
                  <p className="mt-1 text-2xl font-bold text-danger-600">{formatCurrency(activeInvoice.total)}</p>
                  <p className="text-xs text-ink-400">
                    Vencimento {formatDateObj(activeInvoice.period.dueDate)}
                  </p>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-ink-500">
                      <span>Limite utilizado</span>
                      <span>{activeInvoice.card.limit > 0 ? Math.round((activeInvoice.total / activeInvoice.card.limit) * 100) : 0}%</span>
                    </div>
                    <ProgressBar percent={activeInvoice.card.limit > 0 ? (activeInvoice.total / activeInvoice.card.limit) * 100 : 0} colorClassName="bg-danger-500" />
                  </div>
                  {activeInvoice.paid ? (
                    <button
                      onClick={() => setPendingReopenInvoiceId(activeInvoice.invoiceId ?? null)}
                      className="mt-4 w-full rounded-lg border border-ink-100 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50"
                    >
                      Fatura paga · Reabrir pagamento
                    </button>
                  ) : (
                    <button
                      onClick={() => setPayingInvoice(true)}
                      disabled={activeInvoice.total <= 0}
                      className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Pagar fatura
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm xl:col-span-2">
                  <h2 className="text-base font-bold text-ink-900">Gastos por categoria (fatura atual)</h2>
                  {categoryData.length === 0 ? (
                    <EmptyState icon={Receipt} title="Sem compras nesta fatura" />
                  ) : (
                    <CategoryChart data={categoryData} total={activeInvoice.total} />
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h2 className="text-base font-bold text-ink-900">Compras recentes</h2>
              {recentPurchases.length === 0 ? (
                <EmptyState icon={Receipt} title="Nenhuma compra no cartão ainda" />
              ) : (
                <ul className="mt-3 divide-y divide-ink-100">
                  {recentPurchases.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink-900">{t.description}</p>
                        <p className="text-xs text-ink-400">{categoryName(t.categoryId)} · {formatDate(t.date)}</p>
                      </div>
                      <span className="font-semibold text-danger-600">- {formatCurrency(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
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
      </div>

      <CardDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <InvoicePaymentModal
        card={payingInvoice ? (activeInvoice?.card ?? null) : null}
        period={payingInvoice ? (activeInvoice?.period ?? null) : null}
        total={activeInvoice?.total ?? 0}
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
    </>
  );
}
