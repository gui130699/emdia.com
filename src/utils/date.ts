import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export function formatDateObj(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

export function formatDateShort(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MMM", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function formatMonthLabel(date: Date): string {
  return format(date, "MMM/yy", { locale: ptBR });
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Formats a Date as a local yyyy-MM-dd string — never use toISOString() for
 * this, it converts to UTC first and can roll the calendar day over. */
export function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function daysUntil(iso: string): number {
  const due = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
