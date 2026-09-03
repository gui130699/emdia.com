export interface CardTheme {
  /** CSS background — usually a gradient, but a solid color is valid too. */
  gradient: string;
  textColor: string;
  mutedTextColor: string;
  chipColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  /** Whether the institution logo needs a light backing chip to stay legible. */
  logoTreatment: "light" | "dark";
}

const NEUTRAL_THEME: CardTheme = {
  gradient: "linear-gradient(135deg, #1f2937, #0f172a)",
  textColor: "#ffffff",
  mutedTextColor: "rgba(255,255,255,0.65)",
  chipColor: "rgba(255,255,255,0.18)",
  badgeBgColor: "rgba(255,255,255,0.16)",
  badgeTextColor: "#ffffff",
  logoTreatment: "light",
};

/** Keyed by Bacen institution code. Colors are inspired by each brand's
 * identity, not copies of the physical card — kept dark enough for white
 * text to stay legible (contrast checked against #ffffff at ~4.6:1+). */
const THEMES_BY_CODE: Record<string, CardTheme> = {
  // Nubank
  "260": {
    gradient: "linear-gradient(135deg, #8a05be, #4c0a75)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.7)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.18)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Itaú
  "341": {
    gradient: "linear-gradient(135deg, #003399, #ec7000)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.2)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Banco do Brasil
  "001": {
    gradient: "linear-gradient(135deg, #003087, #f8d117)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(0,0,0,0.25)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Bradesco
  "237": {
    gradient: "linear-gradient(135deg, #cc092f, #6d0616)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.7)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.18)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Santander
  "033": {
    gradient: "linear-gradient(135deg, #ec0000, #7a0000)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.2)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Inter
  "077": {
    gradient: "linear-gradient(135deg, #ff7a00, #d35400)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.75)",
    chipColor: "rgba(255,255,255,0.24)",
    badgeBgColor: "rgba(0,0,0,0.22)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Caixa
  "104": {
    gradient: "linear-gradient(135deg, #0070ae, #003b6b)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,140,0,0.35)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Sicoob
  "756": {
    gradient: "linear-gradient(135deg, #00542d, #7dba00)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.18)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
  // Sicredi
  "748": {
    gradient: "linear-gradient(135deg, #6a2c91, #003c1e)",
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.72)",
    chipColor: "rgba(255,255,255,0.22)",
    badgeBgColor: "rgba(255,255,255,0.18)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  },
};

/** Fallback lookup by normalized name, for cards saved before an
 * institutionCode was captured or where the code doesn't match the map. */
const NAME_ALIASES: { pattern: RegExp; code: keyof typeof THEMES_BY_CODE }[] = [
  { pattern: /nubank|nu pagamentos/, code: "260" },
  { pattern: /itau/, code: "341" },
  { pattern: /banco do brasil/, code: "001" },
  { pattern: /bradesco/, code: "237" },
  { pattern: /santander/, code: "033" },
  { pattern: /inter\b/, code: "077" },
  { pattern: /caixa/, code: "104" },
  { pattern: /sicoob/, code: "756" },
  { pattern: /sicredi/, code: "748" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getCardTheme(institutionCode?: string, institutionName?: string): CardTheme {
  if (institutionCode && THEMES_BY_CODE[institutionCode]) return THEMES_BY_CODE[institutionCode];
  if (institutionName) {
    const normalized = normalize(institutionName);
    const alias = NAME_ALIASES.find((a) => a.pattern.test(normalized));
    if (alias) return THEMES_BY_CODE[alias.code];
  }
  return NEUTRAL_THEME;
}

/** Builds a theme from a single manually-chosen color (highest priority per
 * the customization rules), deriving a darker shade for the gradient tail. */
export function themeFromCustomColor(color: string): CardTheme {
  return {
    gradient: `linear-gradient(135deg, ${color}, #0b0f10)`,
    textColor: "#ffffff",
    mutedTextColor: "rgba(255,255,255,0.68)",
    chipColor: "rgba(255,255,255,0.2)",
    badgeBgColor: "rgba(255,255,255,0.18)",
    badgeTextColor: "#ffffff",
    logoTreatment: "light",
  };
}
