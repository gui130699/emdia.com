import Drawer from "../ui/Drawer";
import CardForm from "./CardForm";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import type { CreditCard } from "../../types/finance";

interface CardDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: CreditCard;
}

const FORM_ID = "card-form";

export default function CardDrawer({ open, onClose, initial }: CardDrawerProps) {
  const { addCard, updateCard } = useFinanceData();
  const { show } = useToast();

  async function handleSubmit(input: Parameters<typeof addCard>[0]) {
    try {
      if (initial) {
        await updateCard(initial.id, input);
        show("Cartão atualizado com sucesso.");
      } else {
        await addCard(input);
        show("Cartão adicionado com sucesso.");
      }
      onClose();
    } catch {
      show("Não foi possível salvar o cartão.", "error");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? "Editar cartão" : "Adicionar cartão"}
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
      <CardForm formId={FORM_ID} initial={initial} onSubmit={handleSubmit} />
    </Drawer>
  );
}
