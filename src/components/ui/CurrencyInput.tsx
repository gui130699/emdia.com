import { useState, useEffect } from "react";

interface CurrencyInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CurrencyInput({ id, value, onChange, placeholder }: CurrencyInputProps) {
  const [cents, setCents] = useState(() => Math.round(value * 100));

  useEffect(() => {
    setCents(Math.round(value * 100));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const nextCents = digits ? parseInt(digits, 10) : 0;
    setCents(nextCents);
    onChange(nextCents / 100);
  }

  return (
    <div className="flex items-center rounded-lg border border-ink-100 bg-surface px-3 focus-within:border-brand-500">
      <span className="text-sm text-ink-400">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={centsToDisplay(cents)}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full border-none bg-transparent px-2 py-2.5 text-sm text-ink-900 outline-none"
      />
    </div>
  );
}
