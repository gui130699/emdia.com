import { useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import SettingsCard from "./SettingsCard";
import BankSelect from "../institutions/BankSelect";
import BankLogo from "../institutions/BankLogo";
import CurrencyInput from "../ui/CurrencyInput";
import FormField from "../ui/FormField";
import { inputClass } from "../ui/formStyles";
import { formatCurrency } from "../../utils/currency";
import type { BankAccountKind } from "../../types/finance";
import type { FinancialInstitution } from "../../types/institution";

const KIND_LABELS: Record<BankAccountKind, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  digital: "Conta digital",
  carteira: "Carteira / Dinheiro",
  outro: "Outro",
};

export default function BankAccountsCard() {
  const { bankAccounts, addBankAccount, deleteBankAccount, getAccountBalance } = useFinanceData();
  const { show } = useToast();

  const [institution, setInstitution] = useState<FinancialInstitution | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BankAccountKind>("corrente");
  const [initialBalance, setInitialBalance] = useState(0);
  const [adding, setAdding] = useState(false);

  async function handleAddWallet() {
    setInstitution(null);
    setKind("carteira");
    setName("Carteira");
    setAdding(true);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await addBankAccount(name, kind, institution ?? undefined, initialBalance);
    setInstitution(null);
    setName("");
    setKind("corrente");
    setInitialBalance(0);
    setAdding(false);
    show("Conta adicionada.");
  }

  return (
    <SettingsCard icon={Landmark} title="Contas bancárias" description="Contas usadas para organizar suas transações">
      <ul className="divide-y divide-ink-100">
        {bankAccounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between gap-3 py-2.5">
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
                </p>
              </div>
            </div>
            <button
              aria-label="Remover conta"
              onClick={() => deleteBankAccount(account.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:bg-danger-500/10 hover:text-danger-600"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

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
          <FormField label="Saldo inicial">
            <CurrencyInput value={initialBalance} onChange={setInitialBalance} />
          </FormField>
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
    </SettingsCard>
  );
}
