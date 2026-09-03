import { useRef, useState } from "react";
import { MoreVertical, Pencil, Receipt, Repeat, Archive, ArchiveRestore, Trash2, Info } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import type { CreditCard } from "../../types/finance";

interface CardActionsMenuProps {
  card: CreditCard;
  onEdit: () => void;
  onViewDetails: () => void;
  onViewInvoices: () => void;
  onViewInstallments: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

export default function CardActionsMenu({
  card,
  onEdit,
  onViewDetails,
  onViewInvoices,
  onViewInstallments,
  onArchive,
  onReactivate,
  onDelete,
}: CardActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="absolute right-2 top-2 z-10" ref={ref}>
      <button
        type="button"
        aria-label="Mais opções do cartão"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/30"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-ink-100 bg-surface p-1 shadow-lg"
        >
          <button onClick={() => run(onEdit)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
            <Pencil size={14} /> Editar cartão
          </button>
          <button onClick={() => run(onViewDetails)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
            <Info size={14} /> Ver detalhes
          </button>
          <button onClick={() => run(onViewInvoices)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
            <Receipt size={14} /> Ver faturas
          </button>
          <button onClick={() => run(onViewInstallments)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
            <Repeat size={14} /> Ver parcelamentos
          </button>
          {card.archived ? (
            <button onClick={() => run(onReactivate)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-brand-700 hover:bg-brand-50">
              <ArchiveRestore size={14} /> Reativar cartão
            </button>
          ) : (
            <button onClick={() => run(onArchive)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
              <Archive size={14} /> Arquivar cartão
            </button>
          )}
          <button onClick={() => run(onDelete)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-danger-600 hover:bg-danger-500/10">
            <Trash2 size={14} /> Excluir cartão
          </button>
        </div>
      )}
    </div>
  );
}
