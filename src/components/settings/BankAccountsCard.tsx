import { useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useFinanceData } from "../../stores/FinanceDataContext";
import { useToast } from "../../stores/ToastContext";
import SettingsCard from "./SettingsCard";
import { inputClass } from "../ui/formStyles";
import type { BankAccountKind } from "../../types/finance";

const KIND_LABELS: Record<BankAccountKind, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  digital: "Conta digital",
  carteira: "Carteira",
};

export default function BankAccountsCard() {
  const { bankAccounts, addBankAccount, deleteBankAccount } = useFinanceData();
  const { show } = useToast();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<BankAccountKind>("corrente");

  async function handleAdd() {
    if (!name.trim()) return;
    await addBankAccount(name, kind);
    setName("");
    show("Conta adicionada.");
  }

  return (
    <SettingsCard icon={Landmark} title="Contas bancárias" description="Contas usadas para organizar suas transações">
      <ul className="divide-y divide-ink-100">
        {bankAccounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-ink-900">{account.name}</p>
              <p className="text-xs text-ink-400">{KIND_LABELS[account.kind]}</p>
            </div>
            <button
              aria-label="Remover conta"
              onClick={() => deleteBankAccount(account.id)}
              className="rounded-lg p-1.5 text-ink-300 hover:bg-danger-500/10 hover:text-danger-600"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} placeholder="Nome da conta" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as BankAccountKind)}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button onClick={handleAdd} className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={15} /> Adicionar
        </button>
      </div>
    </SettingsCard>
  );
}
