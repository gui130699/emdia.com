import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { useSettings } from "../../stores/SettingsContext";
import SettingsCard from "./SettingsCard";
import { inputClass } from "../ui/formStyles";
import type { ThemePreference } from "../../types/finance";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

const ACCENT_COLORS = ["#059669", "#2563eb", "#7c3aed", "#f59e0b", "#dc2626", "#0f6466"];

export default function AppearanceCard() {
  const { settings, updateAppearance } = useSettings();
  const { appearance } = settings;

  return (
    <SettingsCard icon={Palette} title="Aparência" description="Personalize como o EM DIA aparece para você">
      <div>
        <p className="mb-2 text-sm font-medium text-ink-700">Tema</p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updateAppearance({ theme: option.value })}
              className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-semibold ${
                appearance.theme === option.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-100 text-ink-500"
              }`}
            >
              <option.icon size={17} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-ink-700">Cor principal</p>
        <div className="flex gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`Cor ${color}`}
              onClick={() => updateAppearance({ accentColor: color })}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
            >
              {appearance.accentColor === color && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-ink-700">Densidade da interface</p>
        <select
          className={inputClass}
          value={appearance.density}
          onChange={(e) => updateAppearance({ density: e.target.value as "comfortable" | "compact" })}
        >
          <option value="comfortable">Padrão</option>
          <option value="compact">Compacta</option>
        </select>
      </div>
    </SettingsCard>
  );
}
