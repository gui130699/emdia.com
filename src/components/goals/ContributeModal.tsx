import { useState } from "react";
import Modal from "../ui/Modal";
import CurrencyInput from "../ui/CurrencyInput";
import type { FinancialGoal, GoalContribution } from "../../types/finance";

interface ContributeModalProps {
  goal: FinancialGoal | null;
  kind: GoalContribution["kind"] | null;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}

export default function ContributeModal({ goal, kind, onClose, onConfirm }: ContributeModalProps) {
  const [amount, setAmount] = useState(0);

  if (!goal || !kind) return null;

  const isDeposit = kind === "deposit";

  return (
    <Modal
      open
      onClose={onClose}
      title={isDeposit ? `Aportar em "${goal.name}"` : `Retirar de "${goal.name}"`}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (amount > 0) {
                await onConfirm(amount);
                setAmount(0);
              }
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Confirmar
          </button>
        </>
      }
    >
      <label className="mb-1.5 block text-sm font-medium text-ink-700">Valor</label>
      <CurrencyInput value={amount} onChange={setAmount} />
    </Modal>
  );
}
