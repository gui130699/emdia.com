import { Pencil, Trash2 } from "lucide-react";
import Badge from "../ui/Badge";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { AccountBill } from "../../types/finance";

const STATUS_CONFIG = {
  paid: { label: "Paga", tone: "success" as const },
  upcoming: { label: "A vencer", tone: "warning" as const },
  overdue: { label: "Atrasada", tone: "danger" as const },
};

interface AccountsTableProps {
  bills: AccountBill[];
  categoryName: (id: string) => string;
  onPay: (bill: AccountBill) => void;
  onEdit: (bill: AccountBill) => void;
  onDelete: (bill: AccountBill) => void;
}

export default function AccountsTable({ bills, categoryName, onPay, onEdit, onDelete }: AccountsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2.5 pr-3 font-medium">Conta</th>
              <th className="py-2.5 pr-3 font-medium">Vencimento</th>
              <th className="py-2.5 pr-3 font-medium">Categoria</th>
              <th className="py-2.5 pr-3 font-medium">Valor</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              <th className="py-2.5 pl-3 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const status = STATUS_CONFIG[bill.status];
              return (
                <tr key={bill.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                  <td className="py-2.5 pr-3 font-medium text-ink-900">{bill.description}</td>
                  <td className="py-2.5 pr-3 text-ink-500">{formatDate(bill.dueDate)}</td>
                  <td className="py-2.5 pr-3 text-ink-500">{categoryName(bill.categoryId)}</td>
                  <td className="py-2.5 pr-3 font-medium text-ink-900">{formatCurrency(bill.amount)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge label={status.label} tone={status.tone} />
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex justify-end gap-2">
                      {bill.status !== "paid" ? (
                        <button onClick={() => onPay(bill)} className="rounded-lg border border-brand-600 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                          Pagar
                        </button>
                      ) : (
                        <button onClick={() => onEdit(bill)} className="rounded-lg border border-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-50">
                          Editar
                        </button>
                      )}
                      <button onClick={() => onDelete(bill)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-500/10">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {bills.map((bill) => {
          const status = STATUS_CONFIG[bill.status];
          return (
            <li key={bill.id} className="rounded-xl border border-ink-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">{bill.description}</p>
                  <p className="truncate text-xs text-ink-400">{categoryName(bill.categoryId)}</p>
                </div>
                <span className="shrink-0 font-semibold text-ink-900">{formatCurrency(bill.amount)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{formatDate(bill.dueDate)}</span>
                  <Badge label={status.label} tone={status.tone} />
                </div>
                <div className="flex items-center gap-1">
                  {bill.status !== "paid" ? (
                    <button
                      onClick={() => onPay(bill)}
                      className="min-h-9 rounded-lg border border-brand-600 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      Pagar
                    </button>
                  ) : (
                    <button
                      aria-label="Editar conta"
                      onClick={() => onEdit(bill)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    aria-label="Excluir conta"
                    onClick={() => onDelete(bill)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-500/10 hover:text-danger-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
