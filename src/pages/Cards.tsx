import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, CreditCard as CardIcon, Receipt, Calendar, CreditCard } from "lucide-react";
import Header from "../components/layout/Header";
import SummaryCard from "../components/ui/SummaryCard";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import CategoryChart from "../components/charts/CategoryChart";
import CardDrawer from "../components/cards/CardDrawer";
import CreditCardVisual from "../components/cards/CreditCardVisual";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../stores/ToastContext";
import { cardService } from "../services/cardService";
import { getCurrentInvoicePeriod, transactionsInPeriod } from "../utils/cardInvoice";
import { categoryBreakdown } from "../services/reportService";
import { formatCurrency } from "../utils/currency";
import { formatDate, formatDateObj } from "../utils/date";

export default function Cards() {
  const { onOpenMenu } = useLayoutContext();
  const { currentUser } = useAuth();
  const { cards, transactions, categories } = useFinanceData();
  const { show } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [paidInvoices, setPaidInvoices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentUser) setPaidInvoices(cardService.getPaidInvoices(currentUser.uid));
  }, [currentUser]);

  const creditCards = cards.filter((c) => c.type === "credito");
  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? creditCards[0];

  const invoicesByCard = useMemo(() => {
    return creditCards.map((card) => {
      const period = getCurrentInvoicePeriod(card);
      const purchases = transactionsInPeriod(transactions, card.id, period);
      const total = purchases.reduce((sum, t) => sum + t.amount, 0);
      const paid = !!paidInvoices[`${card.id}:${period.periodKey}`];
      return { card, period, purchases, total, paid };
    });
  }, [creditCards, transactions, paidInvoices]);

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

  async function handlePayInvoice() {
    if (!currentUser || !activeInvoice) return;
    cardService.markInvoicePaid(currentUser.uid, activeInvoice.card.id, activeInvoice.period.periodKey);
    setPaidInvoices(cardService.getPaidInvoices(currentUser.uid));
    show("Fatura marcada como paga.");
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="flex flex-wrap gap-4">
              {creditCards.map((card) => (
                <button key={card.id} onClick={() => setSelectedCardId(card.id)} className={`rounded-2xl ${selectedCard?.id === card.id ? "ring-2 ring-brand-500" : ""}`}>
                  <CreditCardVisual card={card} />
                </button>
              ))}
            </div>

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
                  <button
                    disabled={activeInvoice.paid}
                    onClick={handlePayInvoice}
                    className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {activeInvoice.paid ? "Fatura paga" : "Pagar fatura"}
                  </button>
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
              <h2 className="text-base font-bold text-ink-900">Resumo dos cartões</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                      <th className="py-2.5 pr-3 font-medium">Cartão</th>
                      <th className="py-2.5 pr-3 font-medium">Limite</th>
                      <th className="py-2.5 pr-3 font-medium">Utilizado</th>
                      <th className="py-2.5 pr-3 font-medium">Disponível</th>
                      <th className="py-2.5 pr-3 font-medium">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesByCard.map(({ card, total, period }) => (
                      <tr key={card.id} className="border-b border-ink-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-ink-900">{card.name} •••• {card.lastFourDigits}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(card.limit)}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(total)}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{formatCurrency(card.limit - total)}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{formatDateObj(period.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <CardDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
