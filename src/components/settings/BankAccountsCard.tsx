import { useState } from "react";
import { Landmark, Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import SettingsCard from "./SettingsCard";
import EmptyState from "../ui/EmptyState";
import ImportWizard from "../imports/ImportWizard";
import BankSelect from "../institutions/BankSelect";
import BankLogo from "../institutions/BankLogo";
import CurrencyInput from "../ui/CurrencyInput";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";
import { formatCurrency } from "../../utils/currency";
import { formatDate, todayISO } from "../../utils/date";
import type { BankAccountKind } from "../../types/finance";
import type { FinancialInstitution } from "../../types/institution";

const KIND_LABELS: Record<BankAccountKind, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  digital: "Conta digital",
  carteira: "Carteira / Dinheiro",
  outro: "Outro",
};

function maskIdentifier(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "••" + value;
  return "••••" + value.slice(-4);
}

export default function BankAccountsCard() {
  const { bankAccounts, addBankAccount, deleteBankAccount, getAccountBalance, reconcileAccountBalance } = useFinanceData();
  const { show } = useToast();

  const [institution, setInstitution] = useState<FinancialInstitution | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BankAccountKind>("corrente");
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceAsOfDate, setBalanceAsOfDate] = useState(todayISO());
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctedBalance, setCorrectedBalance] = useState(0);
  const [correcting, setCorrecting] = useState(false);

  function openCorrection(accountId: string) {
    setCorrectingId(accountId);
    setCorrectedBalance(getAccountBalance(accountId));
  }

  async function handleCorrectBalance() {
    if (!correctingId) return;
    setCorrecting(true);
    try {
      await reconcileAccountBalance(correctingId, correctedBalance, todayISO(), "manual");
      show("Saldo corrigido.");
      setCorrectingId(null);
    } finally {
      setCorrecting(false);
    }
  }

  function handleAddWallet() {
    setInstitution(null);
    setKind("carteira");
    setName("Carteira");
    setAdding(true);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await addBankAccount(name, kind, institution ?? undefined, currentBalance, balanceAsOfDate);
    setInstitution(null);
    setName("");
    setKind("corrente");
    setCurrentBalance(0);
    setBalanceAsOfDate(todayISO());
    setAdding(false);
    show("Conta adicionada.");
  }

  return (
    <SettingsCard icon={Landmark} title="Contas bancárias" description="Contas usadas para organizar suas transações">
      {bankAccounts.length === 0 && !adding && (
        <>
          <EmptyState
            icon={Landmark}
            title="Você ainda não possui contas financeiras cadastradas."
            description="Cadastre uma conta manualmente ou importe um extrato para detectarmos o banco automaticamente."
            actionLabel="Adicionar conta"
            onAction={() => setAdding(true)}
          />
          <button
            onClick={() => setImportOpen(true)}
            className="mx-auto mt-3 block text-sm font-semibold text-brand-700 hover:underline"
          >
            Importar extrato
          </button>
        </>
      )}

      {bankAccounts.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {bankAccounts.map((account) => {
            const maskedId = maskIdentifier(account.externalBankAccountId);
            return (
              <li key={account.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BankLogo
                      name={account.institutionName ?? account.name}
                      code={account.institutionCode}
                      logoUrl={account.institutionLogoUrl}
                      size={32}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{account.name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {KIND_LABELS[account.kind]} · {formatCurrency(getAccountBalance(account.id))}
                        {maskedId ? ` · ${maskedId}` : ""}
                      </p>
                      {account.reconciliationStatus && account.reconciliationStatus !== "unreconciled" && (
                        <p
                          className={`mt-0.5 flex items-center gap-1 text-xs ${
                            account.reconciliationStatus === "discrepancy" ? "text-warning-600" : "text-success-600"
                          }`}
                        >
                          {account.reconciliationStatus === "discrepancy" ? (
                            <AlertTriangle size={11} />
                          ) : (
                            <CheckCircle2 size={11} />
                          )}
                          {account.reconciliationStatus === "discrepancy"
                            ? "Diferença encontrada"
                            : account.reconciliationStatus === "initial_reference"
                              ? "Saldo inicial registrado"
                              : "Saldo conferido"}
                          {account.lastReconciledAt ? ` · ${formatDate(account.lastReconciledAt.slice(0, 10))}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {correctingId !== account.id && (
                      <button
                        onClick={() => openCorrection(account.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        Corrigir saldo
                      </button>
                    )}
                    <button
                      aria-label="Remover conta"
                      onClick={() => deleteBankAccount(account.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:bg-danger-500/10 hover:text-danger-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {correctingId === account.id && (
                  <div className="mt-2 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3">
                    <p className="text-xs text-ink-500">
                      Informe o saldo real desta conta hoje — vira a nova referência e substitui a diferença encontrada.
                    </p>
                    <FormField label="Saldo correto">
                      <CurrencyInput value={correctedBalance} onChange={setCorrectedBalance} />
                    </FormField>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCorrectingId(null)}
                        className="flex-1 rounded-lg border border-ink-100 py-2 text-sm font-medium text-ink-600 hover:bg-surface"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCorrectBalance}
                        disabled={correcting}
                        className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!adding ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={15} /> Adicionar conta
          </button>
          <button
            onClick={handleAddWallet}
            className="min-h-11 rounded-lg border border-ink-100 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            + Carteira
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-100 p-3">
          {kind !== "carteira" && (
            <FormField label="Instituição">
              <BankSelect
                value={institution}
                onSelect={(inst) => {
                  setInstitution(inst);
                  if (!name) setName(inst.name);
                }}
              />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nome da conta">
              <input className={inputClass} placeholder="Ex: Conta principal" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Tipo">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as BankAccountKind)}>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Saldo atual">
              <CurrencyInput value={currentBalance} onChange={setCurrentBalance} />
            </FormField>
            <FormField label="Posição em">
              <input type="date" className={inputClass} value={balanceAsOfDate} onChange={(e) => setBalanceAsOfDate(e.target.value)} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="flex-1 rounded-lg border border-ink-100 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} mode="account" />
    </SettingsCard>
  );
}
