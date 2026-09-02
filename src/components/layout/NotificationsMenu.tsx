import { useRef, useState } from "react";
import { Bell, AlertTriangle, Clock } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { formatCurrency } from "../../utils/currency";
import { daysUntil } from "../../utils/date";

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const { bills } = useFinanceData();
  const relevant = bills
    .filter((b) => b.status === "overdue" || (b.status === "upcoming" && daysUntil(b.dueDate) <= 7))
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
    .slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-500 hover:bg-ink-50"
      >
        <Bell size={19} />
        {relevant.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
            {relevant.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-ink-100 bg-surface p-2 shadow-lg">
          <p className="px-2 py-1.5 text-sm font-semibold text-ink-900">Notificações</p>
          {relevant.length === 0 ? (
            <p className="px-2 py-4 text-sm text-ink-400">Nenhuma pendência no momento.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {relevant.map((bill) => {
                const overdue = bill.status === "overdue";
                return (
                  <li key={bill.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-ink-50">
                    <span className={overdue ? "text-danger-500" : "text-warning-500"}>
                      {overdue ? <AlertTriangle size={16} /> : <Clock size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{bill.description}</p>
                      <p className="text-xs text-ink-400">
                        {overdue ? "Atrasada" : `Vence em ${daysUntil(bill.dueDate)} dia(s)`} ·{" "}
                        {formatCurrency(bill.amount)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
