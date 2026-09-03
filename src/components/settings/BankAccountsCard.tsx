import { useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import SettingsCard from "./SettingsCard";
import BankSelect from "../institutions/BankSelect";
import BankLogo from "../institutions/BankLogo";
import { inputClass } from "../ui/formStyles";
import type { BankAccountKind } from "../../types/finance";
import type { FinancialInstitution } from "../../types/institution";

const KIND_LABELS: Record<BankAccountKind, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  digital: "Conta digital",
  carteira: "Carteira",
};

export default function BankAccountsCard() {
  const { bankAccounts, addBankAccount, deleteBankAccount } = useFinanceData();
  const { show } = useToast();

  const [institution, setInstitution] = useState<FinancialInstitution | null>(null);
  const [kind, setKind] = useState<BankAccountKind>("corrente");

  async function handleAdd() {
    if (!institution) return;
    await addBankAccount(institution.name, kind, institution);
    setInstitution(null);
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
                <p className="truncate text-xs text-ink-400">{KIND_LABELS[account.kind]}</p>
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <BankSelect value={institution} onSelect={setInstitution} />
        </div>
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as BankAccountKind)}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!institution}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>
    </SettingsCard>
  );
}
