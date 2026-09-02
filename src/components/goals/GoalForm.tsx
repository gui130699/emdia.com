import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import type { FinancialGoal } from "../../types/finance";
import type { FinancialGoalInput } from "../../services/goalService";

const ICONS = ["🎯", "✈️", "🚗", "🎓", "🏠", "💍", "🏖️", "💻", "🩺", "🛡️"];

const schema = z.object({
  name: z.string().min(1, "Informe um nome"),
  description: z.string().optional(),
  targetAmount: z.number().positive("Informe um valor maior que zero"),
  currentAmount: z.number().nonnegative(),
  deadline: z.string().min(1, "Informe o prazo"),
  icon: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface GoalFormProps {
  formId: string;
  initial?: FinancialGoal;
  onSubmit: (input: FinancialGoalInput) => Promise<void>;
}

export default function GoalForm({ formId, initial, onSubmit }: GoalFormProps) {
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
          name: initial.name,
          description: initial.description ?? "",
          targetAmount: initial.targetAmount,
          currentAmount: initial.currentAmount,
          deadline: initial.deadline,
          icon: initial.icon,
        }
      : {
          name: "",
          description: "",
          targetAmount: 0,
          currentAmount: 0,
          deadline: "",
          icon: ICONS[0],
        },
  });

  const icon = watch("icon");

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Nome da meta" htmlFor="name" error={errors.name?.message}>
        <input id="name" className={inputClass} placeholder="Ex: Reserva de emergência" {...register("name")} />
      </FormField>

      <FormField label="Descrição (opcional)" htmlFor="description">
        <input id="description" className={inputClass} placeholder="Ex: Segurança para imprevistos" {...register("description")} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Valor objetivo" error={errors.targetAmount?.message}>
          <Controller control={control} name="targetAmount" render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} />} />
        </FormField>
        <FormField label="Valor já guardado" error={errors.currentAmount?.message}>
          <Controller control={control} name="currentAmount" render={({ field }) => <CurrencyInput value={field.value} onChange={field.onChange} />} />
        </FormField>
      </div>

      <FormField label="Data limite" htmlFor="deadline" error={errors.deadline?.message}>
        <input id="deadline" type="date" className={inputClass} {...register("deadline")} />
      </FormField>

      <FormField label="Ícone">
        <div className="flex flex-wrap gap-2">
          {ICONS.map((option) => (
            <label key={option}>
              <input type="radio" value={option} className="sr-only" {...register("icon")} />
              <span
                className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-lg ${
                  icon === option ? "bg-brand-100 ring-2 ring-brand-500" : "bg-ink-50"
                }`}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
      </FormField>
    </form>
  );
}
