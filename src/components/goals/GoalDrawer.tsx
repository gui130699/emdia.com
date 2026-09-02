import Drawer from "../ui/Drawer";
import GoalForm from "./GoalForm";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import type { FinancialGoal } from "../../types/finance";

interface GoalDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: FinancialGoal;
}

const FORM_ID = "goal-form";

export default function GoalDrawer({ open, onClose, initial }: GoalDrawerProps) {
  const { addGoal, updateGoal } = useFinanceData();
  const { show } = useToast();

  async function handleSubmit(input: Parameters<typeof addGoal>[0]) {
    try {
      if (initial) {
        await updateGoal(initial.id, input);
        show("Meta atualizada com sucesso.");
      } else {
        await addGoal(input);
        show("Meta criada com sucesso.");
      }
      onClose();
    } catch {
      show("Não foi possível salvar a meta.", "error");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? "Editar meta" : "Criar nova meta"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button type="submit" form={FORM_ID} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Salvar
          </button>
        </div>
      }
    >
      <GoalForm formId={FORM_ID} initial={initial} onSubmit={handleSubmit} />
    </Drawer>
  );
}
