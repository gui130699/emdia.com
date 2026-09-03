interface BadgeProps {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}

const TONES: Record<BadgeProps["tone"], string> = {
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-500/10 text-warning-700",
  danger: "bg-danger-500/10 text-danger-700",
  neutral: "bg-ink-100 text-ink-600",
};

export default function Badge({ label, tone }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {label}
    </span>
  );
}
