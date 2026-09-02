import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
}

export default function SummaryCard({
  icon: Icon,
  iconClassName = "bg-brand-50 text-brand-600",
  label,
  value,
  hint,
  hintClassName = "text-ink-400",
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>
          <Icon size={19} />
        </span>
        <p className="text-sm text-ink-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-ink-900">{value}</p>
      {hint && <p className={`mt-1 text-xs font-medium ${hintClassName}`}>{hint}</p>}
    </div>
  );
}
