import { useState, useRef } from "react";
import { MoreVertical, Pencil, Trash2, PlusCircle, MinusCircle } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import ProgressBar from "../ui/ProgressBar";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { FinancialGoal } from "../../types/finance";

interface GoalCardProps {
  goal: FinancialGoal;
  onEdit: () => void;
  onDelete: () => void;
  onContribute: () => void;
  onWithdraw: () => void;
}

export default function GoalCard({ goal, onEdit, onDelete, onContribute, onWithdraw }: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setMenuOpen(false));

  const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg">{goal.icon}</span>
          <div>
            <p className="font-semibold text-ink-900">{goal.name}</p>
            {goal.description && <p className="text-xs text-ink-400">{goal.description}</p>}
          </div>
        </div>

        <div className="relative" ref={ref}>
          <button aria-label="Mais opções" onClick={() => setMenuOpen((v) => !v)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-ink-100 bg-surface p-1 shadow-lg">
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50">
                <Pencil size={14} /> Editar
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-danger-600 hover:bg-danger-500/10">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: stacked amounts + deadline. Desktop row below is unchanged. */}
      <div className="mt-4 space-y-1 text-sm md:hidden">
        <div className="flex items-center justify-between">
          <span className="text-ink-500">
            {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
          </span>
          <span className="font-bold text-brand-700">{percent.toFixed(0)}%</span>
        </div>
        <p className="text-xs text-ink-400">Prazo: {formatDate(goal.deadline)}</p>
      </div>

      <div className="mt-4 hidden items-center justify-between text-sm md:flex">
        <span className="text-ink-500">
          {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
        </span>
        <span className="text-ink-500">Prazo: {formatDate(goal.deadline)}</span>
        <span className="font-bold text-brand-700">{percent.toFixed(0)}%</span>
      </div>
      <div className="mt-2">
        <ProgressBar percent={percent} />
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onContribute} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
          <PlusCircle size={15} /> Aportar
        </button>
        <button onClick={onWithdraw} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-50 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100">
          <MinusCircle size={15} /> Retirar
        </button>
      </div>
    </div>
  );
}
