import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
  className?: string;
}

export default function SummaryCard({
  icon: Icon,
  iconClassName = "bg-brand-50 text-brand-600",
  label,
  value,
  hint,
  hintClassName = "text-ink-400",
  className = "",
}: SummaryCardProps) {
  return (
    <div className={`min-w-0 rounded-2xl border border-ink-100 bg-surface p-3.5 shadow-sm sm:p-5 ${className}`}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconClassName}`}>
          <Icon size={19} />
        </span>
        <p className="min-w-0 wrap-break-word text-xs leading-snug text-ink-500 sm:text-sm">{label}</p>
      </div>
      <p className="mt-3 truncate text-lg font-bold text-ink-900 sm:text-2xl">{value}</p>
      {hint && <p className={`mt-1 wrap-break-word text-xs font-medium ${hintClassName}`}>{hint}</p>}
    </div>
  );
}
