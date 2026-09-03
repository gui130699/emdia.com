import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFinanceData } from "../../stores/FinanceDataContext";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import BankSelect from "../institutions/BankSelect";
import { inputClass } from "../ui/formStyles";
import type { CreditCard } from "../../types/finance";
import type { CreditCardInput } from "../../services/cardService";
import type { FinancialInstitution } from "../../types/institution";

const COLORS = ["#0a6847", "#0f6466", "#1e3a8a", "#7c3aed", "#111827", "#b91c1c"];

const schema = z.object({
  name: z.string().min(1, "Informe um nome"),
  institution: z.string().min(1, "Selecione a instituição"),
  institutionCode: z.string().optional(),
  institutionIspb: z.string().optional(),
  institutionLogoUrl: z.string().optional(),
  type: z.enum(["credito", "debito"]),
  lastFourDigits: z.string().regex(/^\d{4}$/, "Informe os últimos 4 números"),
  limit: z.number().nonnegative().optional(),
  limitUnknown: z.boolean(),
  closingDay: z.number().min(1).max(31).optional(),
  dueDay: z.number().min(1).max(31).optional(),
  accountId: z.string().optional(),
  color: z.string(),
  useCustomColor: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface CardFormProps {
  formId: string;
  initial?: CreditCard;
  onSubmit: (input: CreditCardInput) => Promise<void>;
}

export default function CardForm({ formId, initial, onSubmit }: CardFormProps) {
  const { bankAccounts } = useFinanceData();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...initial,
          limit: initial.limit,
          limitUnknown: initial.limit == null,
          closingDay: initial.closingDay,
          dueDay: initial.dueDay,
        }
      : {
          name: "",
          institution: "",
          institutionCode: "",
          institutionIspb: "",
          institutionLogoUrl: "",
          type: "credito",
          lastFourDigits: "",
          limit: undefined,
          limitUnknown: true,
          closingDay: undefined,
          dueDay: undefined,
          accountId: "",
          color: COLORS[0],
          useCustomColor: false,
        },
  });

  const color = watch("color");
  const useCustomColor = watch("useCustomColor");
  const limitUnknown = watch("limitUnknown");

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(({ limitUnknown, ...values }) =>
        onSubmit({
          ...values,
          limit: values.type === "debito" || limitUnknown ? undefined : values.limit,
        })
      )}
      className="space-y-4"
    >
      <FormField label="Nome do cartão" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} placeholder="Ex: EM DIA Platinum" {...register("name")} />
      </FormField>

      <FormField label="Instituição" error={errors.institution?.message}>
        <Controller
          control={control}
          name="institution"
          render={({ field }) => (
            <BankSelect
              value={
                field.value
                  ? {
                      name: field.value,
                      code: watch("institutionCode") ?? "",
                      ispb: watch("institutionIspb") ?? "",
                      fullName: field.value,
                      logoUrl: watch("institutionLogoUrl") || undefined,
                    }
                  : undefined
              }
              onSelect={(inst: FinancialInstitution) => {
                setValue("institution", inst.name);
                setValue("institutionCode", inst.code);
                setValue("institutionIspb", inst.ispb);
                setValue("institutionLogoUrl", inst.logoUrl ?? "");
              }}
            />
          )}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipo" htmlFor="type">
          <select id="type" className={inputClass} {...register("type")}>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
          </select>
        </FormField>
        <FormField label="Últimos 4 números" htmlFor="lastFourDigits" error={errors.lastFourDigits?.message}>
          <input id="lastFourDigits" maxLength={4} inputMode="numeric" className={inputClass} placeholder="0000" {...register("lastFourDigits")} />
        </FormField>
      </div>

      <FormField label="Limite" error={errors.limit?.message}>
        {limitUnknown ? (
          <input className={inputClass} value="Não informado" disabled />
        ) : (
          <Controller
            control={control}
            name="limit"
            render={({ field }) => <CurrencyInput value={field.value ?? 0} onChange={field.onChange} />}
          />
        )}
      </FormField>
      <label className="-mt-2 flex items-center gap-2 text-xs font-medium text-ink-600">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register("limitUnknown")} />
        Não sei o limite deste cartão
      </label>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dia de fechamento" htmlFor="closingDay" error={errors.closingDay?.message}>
          <input
            id="closingDay"
            type="number"
            min={1}
            max={31}
            placeholder="Não informado"
            className={inputClass}
            {...register("closingDay", { setValueAs: (value) => value === "" ? undefined : Number(value) })}
          />
        </FormField>
        <FormField label="Dia de vencimento" htmlFor="dueDay" error={errors.dueDay?.message}>
          <input
            id="dueDay"
            type="number"
            min={1}
            max={31}
            placeholder="Não informado"
            className={inputClass}
            {...register("dueDay", { setValueAs: (value) => value === "" ? undefined : Number(value) })}
          />
        </FormField>
      </div>
      <p className="-mt-2 text-xs text-ink-400">Deixe em branco quando o fechamento ou o vencimento ainda não forem conhecidos.</p>

      <FormField label="Conta relacionada" htmlFor="accountId">
        <select id="accountId" className={inputClass} {...register("accountId")}>
          <option value="">Nenhuma conta selecionada</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register("useCustomColor")} />
        Usar cor personalizada
      </label>
      <p className="-mt-2 text-xs text-ink-400">
        Sem isso, o cartão usa automaticamente as cores da instituição escolhida.
      </p>

      {useCustomColor && (
        <FormField label="Cor do cartão">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <label key={c}>
                <input type="radio" value={c} className="sr-only" {...register("color")} />
                <span
                  className={`block h-8 w-8 cursor-pointer rounded-full ring-offset-2 ${color === c ? "ring-2 ring-ink-700" : ""}`}
                  style={{ backgroundColor: c }}
                />
              </label>
            ))}
          </div>
        </FormField>
      )}
    </form>
  );
}
