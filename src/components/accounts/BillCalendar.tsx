import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AccountBill } from "../../types/finance";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function BillCalendar({ bills }: { bills: AccountBill[] }) {
  const [reference, setReference] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(reference));
    const end = endOfWeek(endOfMonth(reference));
    return eachDayOfInterval({ start, end });
  }, [reference]);

  const billsByDay = useMemo(() => {
    const map = new Map<string, AccountBill[]>();
    for (const bill of bills) {
      const key = bill.dueDate;
      map.set(key, [...(map.get(key) ?? []), bill]);
    }
    return map;
  }, [bills]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink-900">Calendário de vencimentos</h2>
        <div className="flex items-center gap-1 text-sm font-medium text-ink-700">
          <button aria-label="Mês anterior" onClick={() => setReference((d) => subMonths(d, 1))} className="rounded-lg p-1.5 hover:bg-ink-50">
            <ChevronLeft size={16} />
          </button>
          <span className="w-28 text-center capitalize">{format(reference, "MMMM yyyy", { locale: ptBR })}</span>
          <button aria-label="Próximo mês" onClick={() => setReference((d) => addMonths(d, 1))} className="rounded-lg p-1.5 hover:bg-ink-50">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-400">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayBills = billsByDay.get(key) ?? [];
          const hasOverdue = dayBills.some((b) => b.status === "overdue");
          const hasUpcoming = dayBills.some((b) => b.status === "upcoming");
          return (
            <div
              key={key}
              className={`flex h-11 flex-col items-center justify-center rounded-lg text-sm ${
                isSameMonth(day, reference) ? "text-ink-700" : "text-ink-200"
              } ${isSameDay(day, new Date()) ? "bg-brand-50 font-bold text-brand-700" : ""}`}
            >
              {format(day, "d")}
              {dayBills.length > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    hasOverdue ? "bg-danger-500" : hasUpcoming ? "bg-warning-500" : "bg-brand-500"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning-500" /> A vencer</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger-500" /> Atrasadas</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" /> Pagas</span>
      </div>
    </div>
  );
}
