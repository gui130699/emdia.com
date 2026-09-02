interface ProgressBarProps {
  percent: number;
  colorClassName?: string;
}

export default function ProgressBar({ percent, colorClassName = "bg-brand-600" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${colorClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
