import Modal from "../ui/Modal";

interface RecurringPauseEndDialogProps {
  open: boolean;
  title: string;
  message: string;
  onRemoveFuture: () => void;
  onKeepFuture: () => void;
  onCancel: () => void;
}

/** A three-way choice (not just confirm/cancel) for pausing or ending a
 * recurring rule: keep the not-yet-paid future occurrences, remove them, or
 * back out entirely. */
export default function RecurringPauseEndDialog({
  open,
  title,
  message,
  onRemoveFuture,
  onKeepFuture,
  onCancel,
}: RecurringPauseEndDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50">
            Cancelar
          </button>
          <button type="button" onClick={onKeepFuture} className="rounded-lg border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">
            Não, manter
          </button>
          <button type="button" onClick={onRemoveFuture} className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-danger-700">
            Sim, remover
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-500">{message}</p>
    </Modal>
  );
}
