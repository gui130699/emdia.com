import Drawer from "../ui/Drawer";
import TransactionForm from "./TransactionForm";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import type { Transaction } from "../../types/finance";

interface TransactionDrawerProps {
  open: boolean;
  onClose: () => void;
  initial?: Transaction;
  defaultType?: Transaction["type"];
}

const FORM_ID = "transaction-form";

export default function TransactionDrawer({ open, onClose, initial, defaultType }: TransactionDrawerProps) {
  const { addTransaction, updateTransaction } = useFinanceData();
  const { show } = useToast();

  async function handleSubmit(input: Parameters<typeof addTransaction>[0]) {
    try {
      if (initial) {
        await updateTransaction(initial.id, input);
        show("Transação atualizada com sucesso.");
      } else {
        await addTransaction(input);
        show("Transação salva com sucesso.");
      }
      onClose();
    } catch {
      show("Não foi possível salvar a transação.", "error");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? "Editar transação" : "Nova transação"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Salvar transação
          </button>
        </div>
      }
    >
      <TransactionForm formId={FORM_ID} initial={initial} defaultType={defaultType} onSubmit={handleSubmit} />
    </Drawer>
  );
}
