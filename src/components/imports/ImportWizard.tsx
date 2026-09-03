import { useMemo, useState } from "react";
import { X, Upload, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import Badge from "../ui/Badge";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import {
  buildCsvPreview,
  buildOfxPreview,
  detectCsvColumnSignature,
  guessCsvMapping,
  parseCsvFile,
  parseOfxFile,
  importService,
  type CsvColumnMapping,
  type ImportPreview,
  type ImportPreviewRow,
} from "../../services/importService";
import type { ParsedOfx } from "../../utils/ofxParser";
import type { ImportRecordStatus } from "../../types/finance";

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  mode: "account" | "card";
  fixedAccountId?: string;
  fixedCardId?: string;
}

const STATUS_BADGE: Record<ImportRecordStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  valid: { label: "Novo", tone: "success" },
  duplicate: { label: "Já importada", tone: "neutral" },
  needsReview: { label: "Revisar", tone: "warning" },
  invalid: { label: "Inválido", tone: "danger" },
};

type Step = "select" | "mapping" | "preview";

export default function ImportWizard({ open, onClose, mode, fixedAccountId, fixedCardId }: ImportWizardProps) {
  const { bankAccounts, cards, transactions, bills, categories, invoices, installmentPlans, installments, addBankAccount, reloadAll } = useFinanceData();
  const { show } = useToast();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";

  const [step, setStep] = useState<Step>("select");
  const [targetAccountId, setTargetAccountId] = useState(fixedAccountId ?? bankAccounts[0]?.id ?? "");
  const [targetCardId, setTargetCardId] = useState(fixedCardId ?? cards.find((c) => c.type === "credito")?.id ?? "");
  const [loadingLabel, setLoadingLabel] = useState("");

  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({ dateColumn: "", descriptionColumn: "" });

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [lastOfx, setLastOfx] = useState<ParsedOfx | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const creditCards = cards.filter((c) => c.type === "credito");
  const target = mode === "card" ? { cardId: targetCardId } : { accountId: targetAccountId };

  function reset() {
    setStep("select");
    setFileName("");
    setCsvHeaders([]);
    setCsvRows([]);
    setPreview(null);
    setRows([]);
    setLoadingLabel("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function runPreview(source: "ofx" | "csv", text: string) {
    const ctx = {
      userId,
      target,
      existingTransactions: transactions,
      bills,
      bankAccounts,
      categories,
      cards,
      invoices,
      installmentPlans,
      installments,
    };
    if (source === "ofx") {
      setLoadingLabel("Analisando arquivo...");
      const ofx = parseOfxFile(text);
      setLastOfx(ofx);
      setLoadingLabel("Verificando duplicidades...");
      const result = await buildOfxPreview(ctx, fileName, ofx);
      setPreview(result);
      setRows(result.rows);
      setStep("preview");
    } else {
      const { headers, rows: parsedRows } = parseCsvFile(text);
      const guess = guessCsvMapping(headers);
      setCsvHeaders(headers);
      setCsvRows(parsedRows);
      if (guess.dateColumn && guess.descriptionColumn && (guess.amountColumn || guess.creditColumn || guess.debitColumn)) {
        setLoadingLabel("Verificando duplicidades...");
        const result = await buildCsvPreview(ctx, fileName, headers, parsedRows, guess as CsvColumnMapping);
        setPreview(result);
        setRows(result.rows);
        setStep("preview");
      } else {
        setMapping({ dateColumn: guess.dateColumn ?? "", descriptionColumn: guess.descriptionColumn ?? "", amountColumn: guess.amountColumn });
        setStep("mapping");
      }
    }
    setLoadingLabel("");
  }

  async function handleCreateDetectedAccount() {
    if (!preview?.institutionCode || !preview.institutionName || !lastOfx) return;
    setCreatingAccount(true);
    try {
      const account = await addBankAccount(
        preview.institutionName,
        "corrente",
        { code: preview.institutionCode, name: preview.institutionName, fullName: preview.institutionName, ispb: "" },
        0
      );
      setTargetAccountId(account.id);
      setLoadingLabel("Verificando duplicidades...");
      const ctx = {
        userId,
        target: { accountId: account.id },
        existingTransactions: transactions,
        bills,
        bankAccounts: [...bankAccounts, account],
        categories,
        cards,
        invoices,
        installmentPlans,
        installments,
      };
      const result = await buildOfxPreview(ctx, fileName, lastOfx);
      setPreview(result);
      setRows(result.rows);
      show(`Conta "${account.name}" criada.`);
    } finally {
      setCreatingAccount(false);
      setLoadingLabel("");
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setLoadingLabel("Lendo arquivo...");
    const text = await file.text();
    const isOfx = /\.ofx$/i.test(file.name);
    try {
      await runPreview(isOfx ? "ofx" : "csv", text);
    } catch (err) {
      setLoadingLabel("");
      show(err instanceof Error ? err.message : "Não foi possível ler este arquivo.", "error");
    }
  }

  async function confirmMapping() {
    if (!mapping.dateColumn || !mapping.descriptionColumn || (!mapping.amountColumn && !mapping.creditColumn && !mapping.debitColumn)) {
      show("Selecione ao menos as colunas de data, descrição e valor.", "error");
      return;
    }
    setLoadingLabel("Verificando duplicidades...");
    const ctx = { userId, target, existingTransactions: transactions, bills, bankAccounts, categories, cards, invoices, installmentPlans, installments };
    const result = await buildCsvPreview(ctx, fileName, csvHeaders, csvRows, mapping);
    setPreview(result);
    setRows(result.rows);
    setLoadingLabel("");
    setStep("preview");

    await importService.saveMapping(userId, {
      fileType: "csv",
      columnSignature: detectCsvColumnSignature(csvHeaders),
      dateColumn: mapping.dateColumn,
      descriptionColumn: mapping.descriptionColumn,
      amountColumn: mapping.amountColumn,
      creditColumn: mapping.creditColumn,
      debitColumn: mapping.debitColumn,
      externalIdColumn: mapping.externalIdColumn,
      dateFormat: "dd/MM/yyyy",
      decimalFormat: "comma",
    }).catch(() => undefined);
  }

  const counts = useMemo(() => {
    const total = rows.length;
    const selected = rows.filter((r) => r.selected).length;
    const duplicate = rows.filter((r) => r.status === "duplicate").length;
    const review = rows.filter((r) => r.status === "needsReview").length;
    return { total, selected, duplicate, review };
  }, [rows]);

  function updateRow(key: string, patch: Partial<ImportPreviewRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleAll(selected: boolean) {
    setRows((prev) => prev.map((r) => (r.status === "duplicate" || r.status === "invalid" ? r : { ...r, selected })));
  }

  async function handleCommit() {
    if (!preview) return;
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      show("Selecione ao menos um lançamento para importar.", "error");
      return;
    }
    setLoadingLabel("Importando...");
    try {
      const batch = await importService.commit(userId, target, preview, selectedRows);
      await reloadAll();
      show(`Importação concluída: ${batch.importedRecords} lançamento(s) importado(s).`);
      handleClose();
    } catch {
      show("Não foi possível concluir a importação.", "error");
    } finally {
      setLoadingLabel("");
    }
  }

  if (!open) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4" role="dialog" aria-modal="true">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl md:max-h-[85dvh] md:w-full md:max-w-3xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-lg font-bold text-ink-900">Importar {mode === "card" ? "fatura do cartão" : "extrato"}</h2>
          <button onClick={handleClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingLabel && <p className="mb-3 text-sm font-medium text-brand-700">{loadingLabel}</p>}

          {step === "select" && (
            <div className="space-y-4">
              {mode === "account" ? (
                <FormField label="Conta financeira" htmlFor="target-account">
                  <select id="target-account" className={inputClass} value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <FormField label="Cartão" htmlFor="target-card">
                  <select id="target-card" className={inputClass} value={targetCardId} onChange={(e) => setTargetCardId(e.target.value)}>
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} •••• {c.lastFourDigits}</option>
                    ))}
                  </select>
                </FormField>
              )}

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 px-6 py-12 text-center hover:border-brand-400 hover:bg-brand-50/40">
                <Upload size={28} className="text-brand-600" />
                <span className="text-sm font-semibold text-ink-900">Selecione um arquivo OFX ou CSV</span>
                <span className="text-xs text-ink-400">Seus arquivos são processados localmente, no seu dispositivo.</span>
                <input
                  type="file"
                  accept=".ofx,.csv,text/csv,application/x-ofx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-ink-600">
                Não reconhecemos automaticamente as colunas deste arquivo. Selecione qual coluna corresponde a cada campo.
              </p>
              <FormField label="Coluna de data" htmlFor="map-date">
                <select id="map-date" className={inputClass} value={mapping.dateColumn} onChange={(e) => setMapping((m) => ({ ...m, dateColumn: e.target.value }))}>
                  <option value="">Selecione</option>
                  {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </FormField>
              <FormField label="Coluna de descrição" htmlFor="map-desc">
                <select id="map-desc" className={inputClass} value={mapping.descriptionColumn} onChange={(e) => setMapping((m) => ({ ...m, descriptionColumn: e.target.value }))}>
                  <option value="">Selecione</option>
                  {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </FormField>
              <FormField label="Coluna de valor (único, com sinal)" htmlFor="map-amount">
                <select id="map-amount" className={inputClass} value={mapping.amountColumn ?? ""} onChange={(e) => setMapping((m) => ({ ...m, amountColumn: e.target.value || undefined }))}>
                  <option value="">Não usar — usar crédito/débito separados</option>
                  {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </FormField>
              {!mapping.amountColumn && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Coluna de crédito" htmlFor="map-credit">
                    <select id="map-credit" className={inputClass} value={mapping.creditColumn ?? ""} onChange={(e) => setMapping((m) => ({ ...m, creditColumn: e.target.value || undefined }))}>
                      <option value="">—</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Coluna de débito" htmlFor="map-debit">
                    <select id="map-debit" className={inputClass} value={mapping.debitColumn ?? ""} onChange={(e) => setMapping((m) => ({ ...m, debitColumn: e.target.value || undefined }))}>
                      <option value="">—</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </FormField>
                </div>
              )}
              <FormField label="Coluna de ID externo (opcional)" htmlFor="map-id">
                <select id="map-id" className={inputClass} value={mapping.externalIdColumn ?? ""} onChange={(e) => setMapping((m) => ({ ...m, externalIdColumn: e.target.value || undefined }))}>
                  <option value="">—</option>
                  {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </FormField>
              <button onClick={confirmMapping} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                Continuar
              </button>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              {preview.institutionName && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                  <span>
                    Banco detectado: {preview.institutionName} {preview.institutionCode ? `/ código ${preview.institutionCode}` : ""}
                  </span>
                  {mode === "account" && !bankAccounts.some((a) => a.institutionCode === preview.institutionCode) && (
                    <button
                      onClick={handleCreateDetectedAccount}
                      disabled={creatingAccount}
                      className="rounded-lg border border-brand-600 bg-surface px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                    >
                      + Criar conta para {preview.institutionName}
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                <span>{counts.total} encontrados</span>
                <span>·</span>
                <span>{counts.selected} selecionados</span>
                {counts.duplicate > 0 && (
                  <span className="flex items-center gap-1 text-ink-400"><Copy size={12} /> {counts.duplicate} já importados</span>
                )}
                {counts.review > 0 && (
                  <span className="flex items-center gap-1 text-warning-600"><AlertTriangle size={12} /> {counts.review} para revisar</span>
                )}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => toggleAll(true)} className="text-brand-700 hover:underline">Selecionar todos</button>
                  <button onClick={() => toggleAll(false)} className="text-ink-400 hover:underline">Limpar seleção</button>
                </div>
              </div>

              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {rows.map((row) => {
                  const badge = STATUS_BADGE[row.status];
                  const disabled = row.status === "duplicate" || row.status === "invalid";
                  return (
                    <li key={row.key} className={`rounded-xl border p-3 ${disabled ? "border-ink-100 opacity-60" : "border-ink-100"}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-ink-300"
                          checked={row.selected}
                          disabled={disabled}
                          onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink-900">{row.description}</p>
                              <p className="text-xs text-ink-400">{formatDate(row.date)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`text-sm font-semibold ${row.type === "income" ? "text-brand-700" : "text-danger-600"}`}>
                                {row.type === "income" ? "+" : "-"} {formatCurrency(row.amount)}
                              </span>
                              <Badge label={badge.label} tone={badge.tone} />
                            </div>
                          </div>

                          {row.statusReason && <p className="mt-1 text-xs text-ink-400">{row.statusReason}</p>}

                          {row.installmentMatch && !row.suggestion && !disabled && (
                            <p className="mt-1 text-xs text-ink-400">
                              Parcela {row.installmentMatch.number}/{row.installmentMatch.total} detectada — nenhum parcelamento correspondente encontrado, será importada como compra avulsa.
                            </p>
                          )}

                          {row.suggestion && (
                            <label className="mt-2 flex items-center gap-2 rounded-lg bg-warning-500/10 px-2.5 py-1.5 text-xs text-warning-700">
                              <input
                                type="checkbox"
                                checked={row.suggestion.confirmed}
                                onChange={(e) => updateRow(row.key, { suggestion: { ...row.suggestion!, confirmed: e.target.checked } })}
                              />
                              {row.suggestion.label}
                            </label>
                          )}

                          {!disabled && !row.suggestion && (
                            <select
                              className="mt-2 w-full rounded-md border border-ink-100 px-2 py-1 text-xs"
                              value={row.categoryId}
                              onChange={(e) => updateRow(row.key, { categoryId: e.target.value })}
                            >
                              <option value="">Sem categoria</option>
                              {categories.filter((c) => c.type === row.type || c.type === "both").map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {step === "preview" && (
          <div className="border-t border-ink-100 px-5 py-4">
            <button
              onClick={handleCommit}
              disabled={counts.selected === 0 || !!loadingLabel}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Importar {counts.selected} lançamento(s)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
