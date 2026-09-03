import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { financialInstitutionService } from "../../services/financialInstitutionService";
import { useClickOutside } from "../../hooks/useClickOutside";
import BankLogo from "./BankLogo";
import { inputClass } from "../ui/formStyles";
import type { FinancialInstitution } from "../../types/institution";

interface BankSelectProps {
  value?: FinancialInstitution | null;
  onSelect: (institution: FinancialInstitution) => void;
  placeholder?: string;
}

export default function BankSelect({ value, onSelect, placeholder = "Busque pelo nome ou código" }: BankSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FinancialInstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  useEffect(() => {
    financialInstitutionService.preload();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      financialInstitutionService
        .searchInstitutions(query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative" ref={containerRef}>
      {value && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${inputClass} flex items-center gap-2.5 text-left`}
        >
          <BankLogo name={value.name} code={value.code} logoUrl={value.logoUrl} size={24} />
          <span className="min-w-0 flex-1 truncate">{value.name}</span>
          <span className="shrink-0 text-xs text-ink-400">{value.code}</span>
        </button>
      ) : (
        <div className={`${inputClass} flex items-center gap-2`}>
          <Search size={16} className="shrink-0 text-ink-300" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-none bg-transparent p-0 outline-none"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-ink-300" />}
        </div>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-100 bg-surface p-1.5 shadow-lg">
          {loading && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-400">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-400">Nenhuma instituição encontrada.</p>
          ) : (
            results.map((inst) => (
              <button
                key={inst.code}
                type="button"
                onClick={() => {
                  onSelect(inst);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50"
              >
                <BankLogo name={inst.name} code={inst.code} logoUrl={inst.logoUrl} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{inst.name}</span>
                  <span className="block truncate text-xs text-ink-400">{inst.fullName}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-400">{inst.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
