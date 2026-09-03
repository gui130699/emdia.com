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
    <div className="flex min-h-11 items-center rounded-lg border border-ink-100 bg-surface px-3 focus-within:border-brand-500 md:min-h-0">
      <span className="text-base text-ink-400 md:text-sm">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={centsToDisplay(cents)}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full border-none bg-transparent px-2 py-2.5 text-base text-ink-900 outline-none md:text-sm"
      />
    </div>
  );
}
