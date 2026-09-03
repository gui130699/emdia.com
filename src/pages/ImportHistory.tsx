import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import Header from "../components/layout/Header";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Badge from "../components/ui/Badge";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { useFinanceData } from "../stores/FinanceDataContext";
import { useToast } from "../stores/ToastContext";
import { formatDate } from "../utils/date";
import type { ImportBatch } from "../types/finance";

const FILE_TYPE_LABEL: Record<ImportBatch["fileType"], string> = {
  ofx: "OFX",
  csv: "CSV",
  xls: "XLS",
  xlsx: "XLSX",
  qif: "QIF",
  pdf: "PDF",
  txt: "TXT",
};

export default function ImportHistory() {
  const { onOpenMenu } = useLayoutContext();
  const { importBatches, bankAccounts, cards, undoImportBatch } = useFinanceData();
  const { show } = useToast();

  const [pendingUndo, setPendingUndo] = useState<ImportBatch | null>(null);

  const sorted = [...importBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function targetName(batch: ImportBatch) {
    if (batch.accountId) return bankAccounts.find((a) => a.id === batch.accountId)?.name ?? "Conta removida";
    if (batch.cardId) return cards.find((c) => c.id === batch.cardId)?.name ?? "Cartão removido";
    return "—";
  }

  async function handleUndo() {
    if (!pendingUndo) return;
    const result = await undoImportBatch(pendingUndo.id);
    if (!result.ok) {
      show(result.reason ?? "Não foi possível desfazer esta importação.", "error");
    } else {
      show("Importação desfeita.");
    }
    setPendingUndo(null);
  }

  return (
    <>
      <Header onOpenMenu={onOpenMenu} title="Importações" subtitle="Histórico de extratos e faturas importados." />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
          {sorted.length === 0 ? (
            <EmptyState icon={History} title="Nenhuma importação realizada ainda" description="Importe um extrato OFX/CSV em Transações ou uma fatura em Cartões." />
          ) : (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                      <th className="py-2.5 pr-3 font-medium">Arquivo</th>
                      <th className="py-2.5 pr-3 font-medium">Tipo</th>
                      <th className="py-2.5 pr-3 font-medium">Destino</th>
                      <th className="py-2.5 pr-3 font-medium">Data</th>
                      <th className="py-2.5 pr-3 font-medium">Novos</th>
                      <th className="py-2.5 pr-3 font-medium">Duplicados</th>
                      <th className="py-2.5 pr-3 font-medium">Status</th>
                      <th className="py-2.5 pl-3 text-right font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((batch) => (
                      <tr key={batch.id} className="border-b border-ink-100 last:border-0">
                        <td className="max-w-[220px] truncate py-2.5 pr-3 font-medium text-ink-900">{batch.fileName}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{FILE_TYPE_LABEL[batch.fileType]}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{targetName(batch)}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{formatDate(batch.createdAt.slice(0, 10))}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{batch.newRecords}</td>
                        <td className="py-2.5 pr-3 text-ink-500">{batch.duplicateRecords}</td>
                        <td className="py-2.5 pr-3">
                          <Badge label={batch.status === "undone" ? "Desfeita" : "Concluída"} tone={batch.status === "undone" ? "neutral" : "success"} />
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          {batch.status !== "undone" && (
                            <button onClick={() => setPendingUndo(batch)} className="inline-flex items-center gap-1 rounded-lg border border-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-50">
                              <RotateCcw size={13} /> Desfazer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 sm:hidden">
                {sorted.map((batch) => (
                  <li key={batch.id} className="rounded-xl border border-ink-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{batch.fileName}</p>
                        <p className="text-xs text-ink-400">{targetName(batch)} · {formatDate(batch.createdAt.slice(0, 10))}</p>
                      </div>
                      <Badge label={batch.status === "undone" ? "Desfeita" : "Concluída"} tone={batch.status === "undone" ? "neutral" : "success"} />
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      {FILE_TYPE_LABEL[batch.fileType]} · {batch.newRecords} novos · {batch.duplicateRecords} duplicados
                    </p>
                    {batch.status !== "undone" && (
                      <button
                        onClick={() => setPendingUndo(batch)}
                        className="mt-3 flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
                      >
                        <RotateCcw size={13} /> Desfazer importação
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingUndo}
        title="Desfazer importação"
        message={`Os lançamentos criados a partir de "${pendingUndo?.fileName}" serão removidos. Contas e faturas já quitadas por eles não serão alteradas automaticamente — reabra o pagamento correspondente antes, se necessário.`}
        confirmLabel="Desfazer"
        onConfirm={handleUndo}
        onCancel={() => setPendingUndo(null)}
      />
    </>
  );
}
