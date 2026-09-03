import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { RECURRING_FREQUENCY_LABELS } from "../../constants/labels";
import { todayISO } from "../../utils/date";
import type { RecurringBillRule, RecurringFrequency } from "../../types/finance";
import type { RecurringBillRuleInput } from "../../services/recurringBillRuleService";

interface RecurringRuleDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: RecurringBillRule;
}

export default function RecurringRuleDrawer({ open, onClose, initial }: RecurringRuleDrawerProps) {
  const { categories, bankAccounts, cards, addRecurringRule, updateRecurringRule } = useFinanceData();
  const { show } = useToast();

  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amountType, setAmountType] = useState<RecurringBillRuleInput["amountType"]>("fixed");
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [startDate, setStartDate] = useState(todayISO());
  const [dayOfMonth, setDayOfMonth] = useState<number | "">("");
  const [endType, setEndType] = useState<RecurringBillRuleInput["endType"]>("never");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState(12);
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDescription(initial.description);
      setCategoryId(initial.categoryId);
      setAmountType(initial.amountType);
      setAmount(initial.amountType === "fixed" ? initial.defaultAmount : initial.estimatedAmount ?? initial.defaultAmount);
      setFrequency(initial.frequency);
      setStartDate(initial.startDate);
      setDayOfMonth(initial.dayOfMonth ?? "");
      setEndType(initial.endType);
      setEndDate(initial.endDate ?? "");
      setMaxOccurrences(initial.maxOccurrences ?? 12);
      setAccountId(initial.accountId ?? "");
      setCardId(initial.cardId ?? "");
    } else {
      setDescription("");
      setCategoryId("");
      setAmountType("fixed");
      setAmount(0);
      setFrequency("monthly");
      setStartDate(todayISO());
      setDayOfMonth("");
      setEndType("never");
      setEndDate("");
      setMaxOccurrences(12);
      setAccountId("");
      setCardId("");
    }
  }, [open, initial]);

  async function handleSubmit() {
    if (!description.trim() || !categoryId) return;
    const input: RecurringBillRuleInput = {
      description: description.trim(),
      categoryId,
      amountType,
      defaultAmount: amountType === "fixed" ? amount : 0,
      estimatedAmount: amountType === "variable" ? amount : undefined,
      frequency,
      startDate,
      dayOfMonth: dayOfMonth === "" ? undefined : Number(dayOfMonth),
      endType,
      endDate: endType === "date" ? endDate : undefined,
      maxOccurrences: endType === "occurrences" ? maxOccurrences : undefined,
      accountId: accountId || undefined,
      cardId: cardId || undefined,
    };

    try {
      if (initial) {
        await updateRecurringRule(initial.id, input, true);
        show("Recorrência atualizada.");
      } else {
        await addRecurringRule(input);
        show("Recorrência criada.");
      }
      onClose();
    } catch {
      show("Não foi possível salvar a recorrência.", "error");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? "Editar recorrência" : "Nova recorrência"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!description.trim() || !categoryId}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Descrição" htmlFor="rule-description">
          <input id="rule-description" className={inputClass} placeholder="Ex: Netflix, Internet, Energia..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>

        <FormField label="Categoria" htmlFor="rule-category">
          <select id="rule-category" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecione</option>
            {categories.filter((c) => c.type !== "income").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-1">
          <label className={`flex cursor-pointer items-center justify-center rounded-md py-2 text-sm font-semibold ${amountType === "fixed" ? "bg-surface text-ink-900 shadow-sm" : "text-ink-400"}`}>
            <input type="radio" className="sr-only" checked={amountType === "fixed"} onChange={() => setAmountType("fixed")} />
            Valor fixo
          </label>
          <label className={`flex cursor-pointer items-center justify-center rounded-md py-2 text-sm font-semibold ${amountType === "variable" ? "bg-surface text-ink-900 shadow-sm" : "text-ink-400"}`}>
            <input type="radio" className="sr-only" checked={amountType === "variable"} onChange={() => setAmountType("variable")} />
            Valor variável
          </label>
        </div>

        <FormField label={amountType === "fixed" ? "Valor" : "Valor estimado"}>
          <CurrencyInput value={amount} onChange={setAmount} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Frequência" htmlFor="rule-frequency">
            <select id="rule-frequency" className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
              {Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Data de início" htmlFor="rule-start">
            <input id="rule-start" type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
        </div>

        {frequency !== "weekly" && (
          <FormField label="Dia de vencimento (opcional)" htmlFor="rule-day">
            <input
              id="rule-day"
              type="number"
              min={1}
              max={31}
              className={inputClass}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Ex: 10"
            />
          </FormField>
        )}

        <FormField label="Término" htmlFor="rule-end">
          <select id="rule-end" className={inputClass} value={endType} onChange={(e) => setEndType(e.target.value as RecurringBillRuleInput["endType"])}>
            <option value="never">Nunca</option>
            <option value="date">Em uma data</option>
            <option value="occurrences">Após X ocorrências</option>
          </select>
        </FormField>

        {endType === "date" && (
          <FormField label="Data de término" htmlFor="rule-end-date">
            <input id="rule-end-date" type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
        )}
        {endType === "occurrences" && (
          <FormField label="Quantidade de ocorrências" htmlFor="rule-max-occurrences">
            <input id="rule-max-occurrences" type="number" min={1} className={inputClass} value={maxOccurrences} onChange={(e) => setMaxOccurrences(Number(e.target.value))} />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Conta (opcional)" htmlFor="rule-account">
            <select id="rule-account" className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Nenhuma</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Cartão (opcional)" htmlFor="rule-card">
            <select id="rule-card" className={inputClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
              <option value="">Nenhum</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name} •••• {c.lastFourDigits}</option>
              ))}
            </select>
          </FormField>
        </div>

        {initial && (
          <p className="text-xs text-ink-400">
            Alterações aqui atualizam a regra e todas as cobranças futuras ainda não pagas. Cobranças já pagas não são alteradas.
          </p>
        )}
      </div>
    </Drawer>
  );
}
