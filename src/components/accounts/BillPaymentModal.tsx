import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { PAYMENT_METHOD_LABELS } from "../../constants/labels";
import { todayISO } from "../../utils/date";
import type { AccountBill, PaymentMethod } from "../../types/finance";

interface BillPaymentModalProps {
  bill: AccountBill | null;
  onClose: () => void;
}

export default function BillPaymentModal({ bill, onClose }: BillPaymentModalProps) {
  const { bankAccounts, cards, payBill, updateBill } = useFinanceData();
  const { show } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bill) return;
    setPaymentMethod(bill.paymentMethod ?? "pix");
    setAccountId(bill.accountId ?? "");
    setCardId("");
    setParcelado(false);
    setInstallmentCount(2);
    setPaidAt(todayISO());
    setPaidAmount(bill.amount);
    setNotes(bill.notes ?? "");
  }, [bill, bankAccounts, cards]);

  if (!bill) return null;

  const isCredit = paymentMethod === "credito";
  const canSubmit = isCredit ? !!cardId : !!accountId;

  async function handleConfirm() {
    if (!bill || !canSubmit || paidAmount <= 0) return;
    setSaving(true);
    try {
      if (notes !== (bill.notes ?? "")) {
        await updateBill(bill.id, { notes });
      }
      const result = await payBill(bill.id, {
        paymentMethod,
        date: paidAt,
        amount: paidAmount,
        notes,
        accountId: isCredit ? undefined : accountId,
        cardId: isCredit ? cardId : undefined,
        installments: isCredit && parcelado ? installmentCount : undefined,
      });
      if (!result.ok) {
        show(result.reason ?? "Não foi possível registrar o pagamento.", "error");
      } else {
        show(`Conta "${bill.description}" paga com sucesso.`);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!bill}
      title="Pagar conta"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || paidAmount <= 0 || saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Confirmar pagamento
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          {bill.description} · {bill.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>

        <FormField label="Forma de pagamento" htmlFor="paymentMethod">
          <select
            id="paymentMethod"
            className={inputClass}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        {isCredit ? (
          <>
            <FormField label="Cartão" htmlFor="cardId">
              <select id="cardId" className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
                <option value="">Selecione</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} •••• {card.lastFourDigits}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-1">
              <label
                className={`flex cursor-pointer items-center justify-center rounded-md py-2 text-sm font-semibold transition-colors ${
                  !parcelado ? "bg-surface text-ink-900 shadow-sm" : "text-ink-400"
                }`}
              >
                <input type="radio" checked={!parcelado} onChange={() => setParcelado(false)} className="sr-only" />
                À vista
              </label>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-md py-2 text-sm font-semibold transition-colors ${
                  parcelado ? "bg-surface text-ink-900 shadow-sm" : "text-ink-400"
                }`}
              >
                <input type="radio" checked={parcelado} onChange={() => setParcelado(true)} className="sr-only" />
                Parcelado
              </label>
            </div>

            {parcelado && (
              <FormField label="Quantidade de parcelas" htmlFor="installmentCount">
                <select
                  id="installmentCount"
                  className={inputClass}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                >
                  {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </>
        ) : (
          <FormField label="Conta" htmlFor="accountId">
            <select id="accountId" className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Selecione</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Data do pagamento" htmlFor="paidAt">
            <input id="paidAt" type="date" className={inputClass} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </FormField>
          <FormField label="Valor pago">
            <CurrencyInput value={paidAmount} onChange={setPaidAmount} />
          </FormField>
        </div>

        <FormField label="Observação (opcional)" htmlFor="notes">
          <textarea id="notes" rows={2} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
