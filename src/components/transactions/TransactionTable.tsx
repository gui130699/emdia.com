import { Copy, Pencil, Trash2 } from "lucide-react";
import type { BankAccount, Category, Transaction } from "../../types/finance";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import Badge from "../ui/Badge";

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  bankAccounts: BankAccount[];
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
}

export default function TransactionTable({
  transactions,
  categories,
  bankAccounts,
  onEdit,
  onDelete,
  onDuplicate,
}: TransactionTableProps) {
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Outros";
  const accountName = (id: string) => bankAccounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <th className="py-3 pr-3 font-medium">Descrição</th>
              <th className="py-3 pr-3 font-medium">Categoria</th>
              <th className="py-3 pr-3 font-medium">Conta</th>
              <th className="py-3 pr-3 font-medium">Data</th>
              <th className="py-3 pr-3 font-medium">Status</th>
              <th className="py-3 pr-3 font-medium">Valor</th>
              <th className="py-3 pl-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                <td className="py-3 pr-3 font-medium text-ink-900">{t.description}</td>
                <td className="py-3 pr-3 text-ink-500">{categoryName(t.categoryId)}</td>
                <td className="py-3 pr-3 text-ink-500">{accountName(t.accountId)}</td>
                <td className="py-3 pr-3 text-ink-500">{formatDate(t.date)}</td>
                <td className="py-3 pr-3">
                  <Badge label="Concluído" tone="success" />
                </td>
                <td className={`py-3 pr-3 font-semibold ${t.type === "income" ? "text-brand-600" : "text-danger-600"}`}>
                  {t.type === "income" ? "+ " : "- "}
                  {formatCurrency(t.amount)}
                </td>
                <td className="py-3 pl-3">
                  <div className="flex justify-end gap-1">
                    <button aria-label="Editar" onClick={() => onEdit(t)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                      <Pencil size={15} />
                    </button>
                    <button aria-label="Duplicar" onClick={() => onDuplicate(t)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                      <Copy size={15} />
                    </button>
                    <button aria-label="Excluir" onClick={() => onDelete(t)} className="rounded-lg p-2 text-ink-400 hover:bg-danger-500/10 hover:text-danger-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {transactions.map((t) => (
          <li key={t.id} className="rounded-xl border border-ink-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink-900">{t.description}</p>
                <p className="text-xs text-ink-400">
                  {categoryName(t.categoryId)} · {accountName(t.accountId)}
                </p>
              </div>
              <span className={`font-semibold ${t.type === "income" ? "text-brand-600" : "text-danger-600"}`}>
                {t.type === "income" ? "+ " : "- "}
                {formatCurrency(t.amount)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-ink-400">{formatDate(t.date)}</p>
              <div className="flex gap-1">
                <button aria-label="Editar" onClick={() => onEdit(t)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
                  <Pencil size={15} />
                </button>
                <button aria-label="Duplicar" onClick={() => onDuplicate(t)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
                  <Copy size={15} />
                </button>
                <button aria-label="Excluir" onClick={() => onDelete(t)} className="rounded-lg p-2 text-ink-400 hover:bg-danger-500/10 hover:text-danger-600">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
