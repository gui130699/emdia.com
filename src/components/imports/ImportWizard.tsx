import { useMemo, useState } from "react";
import { X, Upload, CheckCircle2, AlertTriangle, Copy, Landmark } from "lucide-react";
import Badge from "../ui/Badge";
import FormField from "../ui/FormField";
import CurrencyInput from "../ui/CurrencyInput";
import { inputClass } from "../ui/formStyles";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/currency";
import { formatDate, todayISO } from "../../utils/date";
import {
  buildCsvPreview,
  buildOfxPreview,
  detectCsvColumnSignature,
  findInstitutionByOfxBankId,
  guessCsvMapping,
  parseCsvFile,
  parseOfxFile,
  importService,
  type CsvColumnMapping,
  type ImportPreview,
  type ImportPreviewRow,
} from "../../services/importService";
import type { ParsedOfx } from "../../utils/ofxParser";
import type { BankAccountKind, ImportRecordStatus } from "../../types/finance";

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

const KIND_LABELS: Record<BankAccountKind, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  digital: "Conta digital",
  carteira: "Carteira / Dinheiro",
  outro: "Outro",
};

function maskIdentifier(value?: string): string {
  if (!value) return "—";
  if (value.length <= 4) return "••" + value;
  return "••••" + value.slice(-4);
}

type Step = "select" | "match" | "choose-account" | "mapping" | "preview" | "reconciliation";

export default function ImportWizard({ open, onClose, mode, fixedAccountId, fixedCardId }: ImportWizardProps) {
  const {
    bankAccounts,
    cards,
    transactions,
    bills,
    categories,
    invoices,
    installmentPlans,
    installments,
    addBankAccount,
    reconcileAccountBalance,
    createBalanceAdjustment,
    reloadAll,
  } = useFinanceData();
  const { show } = useToast();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";

  const [step, setStep] = useState<Step>("select");
  const [targetAccountId, setTargetAccountId] = useState(fixedAccountId ?? "");
  const [targetCardId, setTargetCardId] = useState(fixedCardId ?? cards.find((c) => c.type === "credito")?.id ?? "");
  const [loadingLabel, setLoadingLabel] = useState("");

  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({ dateColumn: "", descriptionColumn: "" });

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [lastOfx, setLastOfx] = useState<ParsedOfx | null>(null);
  const [committedBatchId, setCommittedBatchId] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<{ calculated: number; reported: number; difference: number; status: "conferred" | "discrepancy" } | null>(null);
  const [correctedBalance, setCorrectedBalance] = useState(0);

  // "match" step (OFX account imports only)
  const [detectedCode, setDetectedCode] = useState<string | undefined>();
  const [detectedName, setDetectedName] = useState<string | undefined>();
  const [candidateAccountId, setCandidateAccountId] = useState<string | undefined>();
  const [choosingOther, setChoosingOther] = useState(false);
  const [otherAccountId, setOtherAccountId] = useState("");
  const [mismatchConfirmed, setMismatchConfirmed] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountKind, setNewAccountKind] = useState<BankAccountKind>("corrente");
  const [newAccountBalance, setNewAccountBalance] = useState(0);
  const [newAccountAsOf, setNewAccountAsOf] = useState(todayISO());

  const creditCards = cards.filter((c) => c.type === "credito");
  const target = mode === "card" ? { cardId: targetCardId } : { accountId: targetAccountId };

  function reset() {
    setStep("select");
    setFileName("");
    setCsvHeaders([]);
    setCsvRows([]);
    setPreview(null);
    setRows([]);
    setLastOfx(null);
    setCommittedBatchId(null);
    setReconciliation(null);
    setDetectedCode(undefined);
    setDetectedName(undefined);
    setCandidateAccountId(undefined);
    setChoosingOther(false);
    setOtherAccountId("");
    setMismatchConfirmed(false);
    setTargetAccountId(fixedAccountId ?? "");
    setLoadingLabel("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function buildCtx(accountId?: string, extraAccounts: typeof bankAccounts = []) {
    return {
      userId,
      target: mode === "card" ? { cardId: targetCardId } : { accountId },
      existingTransactions: transactions,
      bills,
      bankAccounts: [...bankAccounts, ...extraAccounts],
      categories,
      cards,
      invoices,
      installmentPlans,
      installments,
    };
  }

  async function runOfxPreview(accountId: string, ofx: ParsedOfx, extraAccounts: typeof bankAccounts = []) {
    setLoadingLabel("Verificando duplicidades...");
    const ctx = buildCtx(accountId, extraAccounts);
    const result = await buildOfxPreview(ctx, fileName, ofx);
    setPreview(result);
    setRows(result.rows);
    setTargetAccountId(accountId);
    setStep("preview");
    setLoadingLabel("");
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setLoadingLabel("Lendo arquivo...");
    try {
      const text = await file.text();
      const isOfx = /\.ofx$/i.test(file.name);

      if (mode === "card") {
        setLoadingLabel("Analisando arquivo...");
        if (isOfx) {
          const ofx = parseOfxFile(text);
          setLastOfx(ofx);
          await runOfxPreview(targetCardId, ofx);
        } else {
          await handleCsvFile(text);
        }
        return;
      }

      if (isOfx) {
        setLoadingLabel("Analisando arquivo...");
        const ofx = parseOfxFile(text);
        setLastOfx(ofx);

        if (fixedAccountId) {
          await runOfxPreview(fixedAccountId, ofx);
          return;
        }

        const institution = findInstitutionByOfxBankId(ofx.bankId);
        setDetectedCode(institution?.code ?? ofx.bankId);
        setDetectedName(institution?.name);

        const exactMatch = ofx.accountId
          ? bankAccounts.find((a) => a.externalBankAccountId === ofx.accountId)
          : undefined;
        if (exactMatch) {
          await runOfxPreview(exactMatch.id, ofx);
          return;
        }

        const byInstitution = (institution?.code ?? ofx.bankId)
          ? bankAccounts.filter((a) => a.institutionCode === (institution?.code ?? ofx.bankId))
          : [];
        setCandidateAccountId(byInstitution.length === 1 ? byInstitution[0].id : undefined);
        setNewAccountName(institution?.name ?? "Nova conta");
        setLoadingLabel("");
        setStep("match");
      } else {
        await handleCsvFile(text);
      }
    } catch (err) {
      setLoadingLabel("");
      show(err instanceof Error ? err.message : "Não foi possível ler este arquivo.", "error");
    }
  }

  async function handleCsvFile(text: string) {
    const { headers, rows: parsedRows } = parseCsvFile(text);
    const guess = guessCsvMapping(headers);
    setCsvHeaders(headers);
    setCsvRows(parsedRows);
    setLoadingLabel("");

    if (mode === "account" && !fixedAccountId && !targetAccountId) {
      setStep("choose-account");
      return;
    }

    if (guess.dateColumn && guess.descriptionColumn && (guess.amountColumn || guess.creditColumn || guess.debitColumn)) {
      await commitCsvPreview(headers, parsedRows, guess as CsvColumnMapping);
    } else {
      setMapping({ dateColumn: guess.dateColumn ?? "", descriptionColumn: guess.descriptionColumn ?? "", amountColumn: guess.amountColumn });
      setStep("mapping");
    }
  }

  async function commitCsvPreview(headers: string[], parsedRows: string[][], m: CsvColumnMapping) {
    setLoadingLabel("Verificando duplicidades...");
    const ctx = buildCtx(mode === "card" ? undefined : targetAccountId || fixedAccountId);
    const result = await buildCsvPreview(ctx, fileName, headers, parsedRows, m);
    setPreview(result);
    setRows(result.rows);
    setLoadingLabel("");
    setStep("preview");
  }

  async function confirmChooseAccount() {
    if (!targetAccountId) return;
    if (csvHeaders.length > 0) {
      const guess = guessCsvMapping(csvHeaders);
      if (guess.dateColumn && guess.descriptionColumn && (guess.amountColumn || guess.creditColumn || guess.debitColumn)) {
        await commitCsvPreview(csvHeaders, csvRows, guess as CsvColumnMapping);
      } else {
        setMapping({ dateColumn: guess.dateColumn ?? "", descriptionColumn: guess.descriptionColumn ?? "", amountColumn: guess.amountColumn });
        setStep("mapping");
      }
    }
  }

  async function handleUseCandidateAccount() {
    if (!candidateAccountId || !lastOfx) return;
    await runOfxPreview(candidateAccountId, lastOfx);
  }

  async function handleConfirmOtherAccount() {
    if (!otherAccountId || !lastOfx) return;
    const account = bankAccounts.find((a) => a.id === otherAccountId);
    const mismatched = detectedCode && account?.institutionCode && account.institutionCode !== detectedCode;
    if (mismatched && !mismatchConfirmed) return;
    await runOfxPreview(otherAccountId, lastOfx);
  }

  async function handleCreateAccountForOfx() {
    if (!lastOfx || !newAccountName.trim()) return;
    setCreatingAccount(true);
    try {
      const account = await addBankAccount(
        newAccountName.trim(),
        newAccountKind,
        detectedCode ? { code: detectedCode, name: detectedName ?? newAccountName, fullName: detectedName ?? newAccountName, ispb: "" } : undefined,
        newAccountBalance,
        newAccountAsOf,
        { externalBankAccountId: lastOfx.accountId, externalBranchId: lastOfx.branchId }
      );
      show(`Conta "${account.name}" criada.`);
      await runOfxPreview(account.id, lastOfx, [account]);
    } finally {
      setCreatingAccount(false);
    }
  }

  async function confirmMapping() {
    if (!mapping.dateColumn || !mapping.descriptionColumn || (!mapping.amountColumn && !mapping.creditColumn && !mapping.debitColumn)) {
      show("Selecione ao menos as colunas de data, descrição e valor.", "error");
      return;
    }
    await commitCsvPreview(csvHeaders, csvRows, mapping);

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

      if (mode === "account" && lastOfx?.balance && target.accountId) {
        const asOfDate = lastOfx.balance.asOf ?? preview.periodEnd ?? todayISO();
        const result = await reconcileAccountBalance(target.accountId, lastOfx.balance.amount, asOfDate, "ofx", batch.id);
        setCommittedBatchId(batch.id);
        setReconciliation(result);
        setCorrectedBalance(result.reported);
        setStep("reconciliation");
      } else {
        handleClose();
      }
    } catch {
      show("Não foi possível concluir a importação.", "error");
    } finally {
      setLoadingLabel("");
    }
  }

  async function handleUseCorrectedBalance() {
    if (!target.accountId || !lastOfx?.balance) return;
    const asOfDate = lastOfx.balance.asOf ?? preview?.periodEnd ?? todayISO();
    await reconcileAccountBalance(target.accountId, correctedBalance, asOfDate, "manual");
    show("Saldo atualizado.");
    handleClose();
  }

  async function handleCreateAdjustment() {
    if (!target.accountId || !reconciliation) return;
    const asOfDate = lastOfx?.balance?.asOf ?? preview?.periodEnd ?? todayISO();
    await createBalanceAdjustment(target.accountId, reconciliation.difference, asOfDate, "Ajuste criado a partir da conferência de importação.");
    if (committedBatchId) {
      await reconcileAccountBalance(target.accountId, reconciliation.reported, asOfDate, "reconciliation", committedBatchId);
    }
    show("Ajuste de saldo criado.");
    handleClose();
  }

  if (!open) return null;

  const detectedLabel = detectedName ? `${detectedName}${detectedCode ? ` / código ${detectedCode}` : ""}` : detectedCode;
  const otherAccount = bankAccounts.find((a) => a.id === otherAccountId);
  const mismatch = !!(detectedCode && otherAccount?.institutionCode && otherAccount.institutionCode !== detectedCode);

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
              {mode === "card" && (
                <FormField label="Cartão" htmlFor="target-card">
                  <select id="target-card" className={inputClass} value={targetCardId} onChange={(e) => setTargetCardId(e.target.value)}>
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} •••• {c.lastFourDigits}</option>
                    ))}
                  </select>
                </FormField>
              )}

              {mode === "account" && !fixedAccountId && (
                <p className="text-sm text-ink-500">
                  Selecione o arquivo primeiro — para OFX, identificamos o banco e a conta automaticamente. Para CSV, pediremos a conta em seguida.
                </p>
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

          {step === "choose-account" && (
            <div className="space-y-4">
              <p className="text-sm text-ink-600">
                Este arquivo CSV não traz identificação do banco. Selecione a qual conta financeira ele pertence.
              </p>
              {bankAccounts.length === 0 ? (
                <p className="rounded-lg bg-warning-500/10 px-3 py-2 text-sm text-warning-700">
                  Você ainda não possui contas financeiras cadastradas. Cadastre uma conta em Configurações antes de importar este arquivo.
                </p>
              ) : (
                <FormField label="Conta financeira" htmlFor="choose-account">
                  <select id="choose-account" className={inputClass} value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
                    <option value="">Selecione</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </FormField>
              )}
              <button
                onClick={confirmChooseAccount}
                disabled={!targetAccountId}
                className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          )}

          {step === "match" && (
            <div className="space-y-4">
              {detectedLabel && (
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">Banco detectado: {detectedLabel}</p>
              )}

              {!choosingOther && candidateAccountId && (
                <div className="rounded-xl border border-ink-100 p-4">
                  <p className="text-sm text-ink-700">
                    Encontramos uma conta cadastrada compatível: <strong>{bankAccounts.find((a) => a.id === candidateAccountId)?.name}</strong>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={handleUseCandidateAccount} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      Usar esta conta
                    </button>
                    <button onClick={() => setChoosingOther(true)} className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                      Escolher outra
                    </button>
                  </div>
                </div>
              )}

              {!choosingOther && !candidateAccountId && (
                <div className="rounded-xl border border-ink-100 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Landmark size={18} className="text-brand-600" />
                    <p className="text-sm font-semibold text-ink-900">Nova conta detectada</p>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-ink-600">
                    <span className="text-ink-400">Instituição</span>
                    <span>{detectedName ?? "Não identificada"}</span>
                    <span className="text-ink-400">Código</span>
                    <span>{detectedCode ?? "—"}</span>
                    <span className="text-ink-400">Tipo</span>
                    <span>{lastOfx?.accountType ?? "—"}</span>
                    <span className="text-ink-400">Identificador</span>
                    <span>{maskIdentifier(lastOfx?.accountId)}</span>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">Esta conta ainda não está cadastrada. Cadastrar esta conta no EM DIA?</p>

                  <div className="mt-3 space-y-3 rounded-lg bg-ink-50 p-3">
                    <FormField label="Nome da conta">
                      <input className={inputClass} value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Tipo">
                        <select className={inputClass} value={newAccountKind} onChange={(e) => setNewAccountKind(e.target.value as BankAccountKind)}>
                          {Object.entries(KIND_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Saldo atual">
                        <CurrencyInput value={newAccountBalance} onChange={setNewAccountBalance} />
                      </FormField>
                    </div>
                    <FormField label="Posição em">
                      <input type="date" className={inputClass} value={newAccountAsOf} onChange={(e) => setNewAccountAsOf(e.target.value)} />
                    </FormField>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleCreateAccountForOfx}
                      disabled={creatingAccount || !newAccountName.trim()}
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Cadastrar conta
                    </button>
                    <button onClick={() => setChoosingOther(true)} className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                      Escolher outra conta
                    </button>
                    <button onClick={() => setStep("select")} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-400 hover:bg-ink-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {choosingOther && (
                <div className="rounded-xl border border-ink-100 p-4">
                  <FormField label="Conta financeira" htmlFor="other-account">
                    <select
                      id="other-account"
                      className={inputClass}
                      value={otherAccountId}
                      onChange={(e) => {
                        setOtherAccountId(e.target.value);
                        setMismatchConfirmed(false);
                      }}
                    >
                      <option value="">Selecione</option>
                      {bankAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </FormField>

                  {mismatch && (
                    <div className="mt-3 space-y-2 rounded-lg bg-warning-500/10 p-3 text-sm text-warning-700">
                      <p>
                        O extrato parece ser do {detectedName ?? "banco detectado"}, mas você selecionou uma conta{" "}
                        {otherAccount?.institutionName ?? otherAccount?.name}.
                      </p>
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={mismatchConfirmed} onChange={(e) => setMismatchConfirmed(e.target.checked)} />
                        Tenho certeza, quero continuar mesmo assim.
                      </label>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setChoosingOther(false)} className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                      Voltar
                    </button>
                    <button
                      onClick={handleConfirmOtherAccount}
                      disabled={!otherAccountId || (mismatch && !mismatchConfirmed)}
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Confirmar conta
                    </button>
                  </div>
                </div>
              )}
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
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                  Banco detectado: {preview.institutionName} {preview.institutionCode ? `/ código ${preview.institutionCode}` : ""}
                </p>
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
                              <span className={`text-sm font-semibold ${row.type === "income" ? "text-success-700" : "text-danger-600"}`}>
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

          {step === "reconciliation" && reconciliation && (
            <div className="space-y-4">
              {reconciliation.status === "conferred" ? (
                <div className="flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm font-semibold text-success-700">
                  <CheckCircle2 size={18} /> Saldo conferido
                </div>
              ) : (
                <div className="space-y-3 rounded-lg bg-warning-500/10 px-4 py-3 text-sm text-warning-700">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle size={18} /> Encontramos uma diferença de {formatCurrency(Math.abs(reconciliation.difference))}.
                  </p>
                  <p className="text-xs">
                    Saldo informado pelo banco: {formatCurrency(reconciliation.reported)} · Saldo calculado pelo EM DIA: {formatCurrency(reconciliation.calculated)}
                  </p>
                </div>
              )}

              {reconciliation.status === "discrepancy" && (
                <div className="space-y-3">
                  <FormField label="Informar saldo correto">
                    <CurrencyInput value={correctedBalance} onChange={setCorrectedBalance} />
                  </FormField>
                  <button onClick={handleUseCorrectedBalance} className="w-full rounded-lg border border-brand-600 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    Informar saldo correto
                  </button>
                  <button onClick={handleCreateAdjustment} className="w-full rounded-lg border border-ink-100 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                    Criar ajuste de saldo
                  </button>
                </div>
              )}

              <button
                onClick={handleClose}
                className={
                  reconciliation.status === "conferred"
                    ? "w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                    : "w-full rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-50"
                }
              >
                {reconciliation.status === "conferred" ? "Concluir" : "Revisar movimentações e decidir depois"}
              </button>
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
