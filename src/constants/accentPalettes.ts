export interface AccentOption {
  id: string;
  label: string;
  swatch: string;
  /** Full 10-step scale applied to --color-brand tokens so every existing
   * bg-brand, text-brand and border-brand utility repaints automatically —
   * no need to touch each component's className. */
  scale: Record<"50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900", string>;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: "green",
    label: "Verde",
    swatch: "#059669",
    scale: {
      "50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7", "400": "#34d399",
      "500": "#10b981", "600": "#059669", "700": "#047a54", "800": "#065f42", "900": "#064e3b",
    },
  },
  {
    id: "blue",
    label: "Azul",
    swatch: "#2563eb",
    scale: {
      "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa",
      "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a",
    },
  },
  {
    id: "violet",
    label: "Roxo",
    swatch: "#7c3aed",
    scale: {
      "50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd", "400": "#a78bfa",
      "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9", "800": "#5b21b6", "900": "#4c1d95",
    },
  },
  {
    id: "orange",
    label: "Laranja",
    swatch: "#ea580c",
    scale: {
      "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74", "400": "#fb923c",
      "500": "#f97316", "600": "#ea580c", "700": "#c2410c", "800": "#9a3412", "900": "#7c2d12",
    },
  },
  {
    id: "red",
    label: "Vermelho",
    swatch: "#dc2626",
    scale: {
      "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171",
      "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d",
    },
  },
  {
    id: "teal",
    label: "Teal",
    swatch: "#0d9488",
    scale: {
      "50": "#f0fdfa", "100": "#ccfbf1", "200": "#99f6e4", "300": "#5eead4", "400": "#2dd4bf",
      "500": "#14b8a6", "600": "#0d9488", "700": "#0f766e", "800": "#115e59", "900": "#134e4a",
    },
  },
];

export const DEFAULT_ACCENT_ID = "green";

export function findAccentOption(idOrSwatch: string): AccentOption {
  return (
    ACCENT_OPTIONS.find((a) => a.id === idOrSwatch || a.swatch === idOrSwatch) ??
    ACCENT_OPTIONS.find((a) => a.id === DEFAULT_ACCENT_ID)!
  );
}

/** Repaints every --color-brand-* token to the chosen accent's scale — this
 * is what actually makes primary buttons, active nav, focus rings, toggles
 * etc. change color, since they all compile to var(--color-brand-*). */
export function applyAccentPalette(idOrSwatch: string) {
  const option = findAccentOption(idOrSwatch);
  const root = document.documentElement;
  for (const [shade, value] of Object.entries(option.scale)) {
    root.style.setProperty(`--color-brand-${shade}`, value);
  }
}
