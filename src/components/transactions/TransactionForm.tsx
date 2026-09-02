import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFinanceData } from "../../stores/FinanceDataContext";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { PAYMENT_METHOD_LABELS, RECURRING_FREQUENCY_LABELS } from "../../constants/labels";
import { todayISO } from "../../utils/date";
import type { Transaction } from "../../types/finance";
import type { TransactionInput } from "../../services/transactionService";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Informe uma descrição"),
  amount: z.number().positive("Informe um valor maior que zero"),
  date: z.string().min(1, "Informe a data"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  accountId: z.string().min(1, "Selecione uma conta"),
  paymentMethod: z.enum(["pix", "dinheiro", "debito", "credito", "boleto", "transferencia"]),
  cardId: z.string().optional(),
  notes: z.string().optional(),
  recurring: z.boolean(),
  recurringFrequency: z
    .enum(["weekly", "monthly", "quarterly", "semiannual", "yearly"])
    .optional(),
});

type FormValues = z.infer<typeof schema>;

interface TransactionFormProps {
  formId: string;
  initial?: Transaction;
  defaultType?: Transaction["type"];
  onSubmit: (input: TransactionInput) => Promise<void>;
}

export default function TransactionForm({ formId, initial, defaultType, onSubmit }: TransactionFormProps) {
  const { categories, bankAccounts, cards } = useFinanceData();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          type: initial.type,
          description: initial.description,
          amount: initial.amount,
          date: initial.date,
          categoryId: initial.categoryId,
          accountId: initial.accountId,
          paymentMethod: initial.paymentMethod,
          cardId: initial.cardId,
          notes: initial.notes ?? "",
          recurring: initial.recurring,
          recurringFrequency: initial.recurringFrequency,
        }
      : {
          type: defaultType ?? "expense",
          description: "",
          amount: 0,
          date: todayISO(),
          categoryId: "",
          accountId: bankAccounts[0]?.id ?? "",
          paymentMethod: "pix",
          notes: "",
          recurring: false,
        },
  });

  const type = watch("type");
  const recurring = watch("recurring");
  const paymentMethod = watch("paymentMethod");
  const availableCategories = categories.filter((c) => c.type === type || c.type === "both");

  async function submit(values: FormValues) {
    await onSubmit({
      ...values,
      recurringFrequency: values.recurring ? values.recurringFrequency : undefined,
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-1">
        {(["expense", "income"] as const).map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center justify-center rounded-md py-2 text-sm font-semibold transition-colors ${
              type === option ? "bg-surface shadow-sm" : "text-ink-400"
            } ${type === option && option === "income" ? "text-brand-700" : ""} ${
              type === option && option === "expense" ? "text-danger-600" : ""
            }`}
          >
            <input type="radio" value={option} {...register("type")} className="sr-only" />
            {option === "income" ? "Receita" : "Despesa"}
          </label>
        ))}
      </div>

      <FormField label="Descrição" htmlFor="description" error={errors.description?.message}>
        <input id="description" className={inputClass} placeholder="Ex: Salário, Mercado..." {...register("description")} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Valor" error={errors.amount?.message}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} />}
          />
        </FormField>
        <FormField label="Data" htmlFor="date" error={errors.date?.message}>
          <input id="date" type="date" className={inputClass} {...register("date")} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Categoria" htmlFor="categoryId" error={errors.categoryId?.message}>
          <select id="categoryId" className={inputClass} {...register("categoryId")}>
            <option value="">Selecione</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Conta" htmlFor="accountId" error={errors.accountId?.message}>
          <select id="accountId" className={inputClass} {...register("accountId")}>
            <option value="">Selecione</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Forma de pagamento" htmlFor="paymentMethod">
        <select id="paymentMethod" className={inputClass} {...register("paymentMethod")}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      {paymentMethod === "credito" && cards.length > 0 && (
        <FormField label="Cartão" htmlFor="cardId">
          <select id="cardId" className={inputClass} {...register("cardId")}>
            <option value="">Nenhum</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} •••• {card.lastFourDigits}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <FormField label="Observação (opcional)" htmlFor="notes">
        <textarea id="notes" rows={2} className={inputClass} {...register("notes")} />
      </FormField>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register("recurring")} />
        Transação recorrente
      </label>

      {recurring && (
        <FormField label="Frequência" htmlFor="recurringFrequency">
          <select id="recurringFrequency" className={inputClass} {...register("recurringFrequency")}>
            {Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      )}
    </form>
  );
}
