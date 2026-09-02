import Drawer from "../ui/Drawer";
import AccountForm from "./AccountForm";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import type { AccountBill } from "../../types/finance";

interface AccountDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: AccountBill;
}

const FORM_ID = "account-bill-form";

export default function AccountDrawer({ open, onClose, initial }: AccountDrawerProps) {
  const { addBill, updateBill } = useFinanceData();
  const { show } = useToast();

  async function handleSubmit(input: Parameters<typeof addBill>[0]) {
    try {
      if (initial) {
        await updateBill(initial.id, input);
        show("Conta atualizada com sucesso.");
      } else {
        await addBill(input);
        show("Conta cadastrada com sucesso.");
      }
      onClose();
    } catch {
      show("Não foi possível salvar a conta.", "error");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? "Editar conta" : "Nova conta"}
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
      <AccountForm formId={FORM_ID} initial={initial} onSubmit={handleSubmit} />
    </Drawer>
  );
}
