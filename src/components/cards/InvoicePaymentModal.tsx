import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { todayISO } from "../../utils/date";
import type { CreditCard } from "../../types/finance";
import type { InvoicePeriod } from "../../utils/cardInvoice";

interface InvoicePaymentModalProps {
  card: CreditCard | null;
  period: InvoicePeriod | null;
  total: number;
  onClose: () => void;
}

export default function InvoicePaymentModal({ card, period, total, onClose }: InvoicePaymentModalProps) {
  const { bankAccounts, payInvoice } = useFinanceData();
  const { show } = useToast();

  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const open = !!card && !!period;

  useEffect(() => {
    if (!open) return;
    setAccountId(card?.accountId ?? bankAccounts[0]?.id ?? "");
    setDate(todayISO());
    setAmount(total);
  }, [open, card, bankAccounts, total]);

  async function handleConfirm() {
    if (!card || !period || !accountId || amount <= 0) return;
    setSaving(true);
    try {
      await payInvoice({ cardId: card.id, period, total: amount, accountId, date });
      show("Fatura paga com sucesso.");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Pagar fatura"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!accountId || amount <= 0 || saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Confirmar pagamento
          </button>
        </>
      }
    >
      {card && (
        <div className="space-y-4">
          <p className="text-sm text-ink-500">{card.name} •••• {card.lastFourDigits}</p>

          <FormField label="Conta utilizada" htmlFor="accountId">
            <select id="accountId" className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Selecione</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Data do pagamento" htmlFor="date">
              <input id="date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField label="Valor">
              <CurrencyInput value={amount} onChange={setAmount} />
            </FormField>
          </div>
        </div>
      )}
    </Modal>
  );
}
