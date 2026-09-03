import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFinanceData } from "../../stores/FinanceDataContext";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { PAYMENT_METHOD_LABELS, RECURRING_FREQUENCY_LABELS } from "../../constants/labels";
import { todayISO } from "../../utils/date";
import type { AccountBill } from "../../types/finance";
import type { AccountBillInput } from "../../services/accountService";

const schema = z.object({
  description: z.string().min(1, "Informe uma descrição"),
  amount: z.number().positive("Informe um valor maior que zero"),
  dueDate: z.string().min(1, "Informe o vencimento"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  accountId: z.string().optional(),
  paymentMethod: z.enum(["pix", "dinheiro", "debito", "credito", "boleto", "transferencia"]).optional(),
  notes: z.string().optional(),
  recurring: z.boolean(),
  recurringFrequency: z.enum(["weekly", "monthly", "quarterly", "semiannual", "yearly"]).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AccountFormProps {
  formId: string;
  initial?: AccountBill;
  onSubmit: (input: AccountBillInput) => Promise<void>;
}

export default function AccountForm({ formId, initial, onSubmit }: AccountFormProps) {
  const { categories, bankAccounts } = useFinanceData();
  const expenseCategories = categories.filter((c) => c.type === "expense" || c.type === "both");

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
          description: initial.description,
          amount: initial.amount,
          dueDate: initial.dueDate,
          categoryId: initial.categoryId,
          accountId: initial.accountId ?? "",
          paymentMethod: initial.paymentMethod,
          notes: initial.notes ?? "",
          recurring: initial.recurring,
          recurringFrequency: initial.recurringFrequency,
        }
      : {
          description: "",
          amount: 0,
          dueDate: todayISO(),
          categoryId: "",
          accountId: "",
          paymentMethod: "boleto",
          notes: "",
          recurring: false,
        },
  });

  const recurring = watch("recurring");

  async function submit(values: FormValues) {
    await onSubmit({ ...values, recurringFrequency: values.recurring ? values.recurringFrequency : undefined });
  }

  return (
    <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormField label="Descrição" htmlFor="description" error={errors.description?.message}>
        <input id="description" className={inputClass} placeholder="Ex: Internet, Aluguel..." {...register("description")} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Valor" error={errors.amount?.message}>
          <Controller control={control} name="amount" render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} />} />
        </FormField>
        <FormField label="Vencimento" htmlFor="dueDate" error={errors.dueDate?.message}>
          <input id="dueDate" type="date" className={inputClass} {...register("dueDate")} />
        </FormField>
      </div>

      <FormField label="Categoria" htmlFor="categoryId" error={errors.categoryId?.message}>
        <select id="categoryId" className={inputClass} {...register("categoryId")}>
          <option value="">Selecione</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Forma de pagamento" htmlFor="paymentMethod">
          <select id="paymentMethod" className={inputClass} {...register("paymentMethod")}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Conta bancária" htmlFor="accountId">
          <select id="accountId" className={inputClass} {...register("accountId")}>
            <option value="">Nenhuma conta selecionada</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Observação (opcional)" htmlFor="notes">
        <textarea id="notes" rows={2} className={inputClass} {...register("notes")} />
      </FormField>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register("recurring")} />
        Conta recorrente
      </label>

      {recurring && (
        <FormField label="Frequência" htmlFor="recurringFrequency">
          <select id="recurringFrequency" className={inputClass} {...register("recurringFrequency")}>
            {Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>
      )}
    </form>
  );
}
