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
  limit: z.number().nonnegative(),
  closingDay: z.number().min(1).max(31),
  dueDay: z.number().min(1).max(31),
  accountId: z.string().optional(),
  color: z.string(),
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
    defaultValues: initial ?? {
      name: "",
      institution: "",
      institutionCode: "",
      institutionIspb: "",
      institutionLogoUrl: "",
      type: "credito",
      lastFourDigits: "",
      limit: 0,
      closingDay: 5,
      dueDay: 15,
      accountId: bankAccounts[0]?.id ?? "",
      color: COLORS[0],
    },
  });

  const color = watch("color");

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((values) =>
        onSubmit({ ...values, limit: values.type === "debito" ? 0 : values.limit })
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
        <Controller control={control} name="limit" render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} />} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dia de fechamento" htmlFor="closingDay" error={errors.closingDay?.message}>
          <input id="closingDay" type="number" min={1} max={31} className={inputClass} {...register("closingDay", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Dia de vencimento" htmlFor="dueDay" error={errors.dueDay?.message}>
          <input id="dueDay" type="number" min={1} max={31} className={inputClass} {...register("dueDay", { valueAsNumber: true })} />
        </FormField>
      </div>

      <FormField label="Conta relacionada" htmlFor="accountId">
        <select id="accountId" className={inputClass} {...register("accountId")}>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

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
    </form>
  );
}
