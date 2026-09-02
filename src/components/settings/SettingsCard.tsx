import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function SettingsCard({ icon: Icon, title, description, children }: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink-900">{title}</h2>
          {description && <p className="text-xs text-ink-400">{description}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
