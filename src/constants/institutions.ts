import type { FinancialInstitution } from "../types/institution";

/**
 * The official Bacen/STR participant list (source of the live API) uses
 * regulatory names — e.g. Nubank is listed as "NU PAGAMENTOS - IP". Real
 * users search by the name on the app icon, so we override the display
 * name for the institutions people actually search for. `fullName` keeps
 * the real legal name either way.
 */
export const TRADE_NAME_OVERRIDES: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Inter",
  "104": "Caixa Econômica Federal",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Banco Safra",
  "623": "Banco Pan",
  "735": "Neon",
  "748": "Sicredi",
  "756": "Sicoob",
  "208": "BTG Pactual",
  "102": "XP Investimentos",
};

/**
 * Built-in fallback so search still works fully offline or if the remote
 * list (BrasilAPI) can't be reached at all.
 */
export const FALLBACK_INSTITUTIONS: FinancialInstitution[] = [
  { code: "001", ispb: "00000000", name: "Banco do Brasil", fullName: "Banco do Brasil S.A." },
  { code: "033", ispb: "90400888", name: "Santander", fullName: "Banco Santander (Brasil) S.A." },
  { code: "077", ispb: "16501555", name: "Inter", fullName: "Banco Inter S.A." },
  { code: "104", ispb: "00360305", name: "Caixa Econômica Federal", fullName: "Caixa Econômica Federal" },
  { code: "212", ispb: "30306294", name: "Banco Original", fullName: "Banco Original S.A." },
  { code: "237", ispb: "60746948", name: "Bradesco", fullName: "Banco Bradesco S.A." },
  { code: "260", ispb: "18236120", name: "Nubank", fullName: "Nu Pagamentos S.A." },
  { code: "290", ispb: "22896431", name: "PagBank", fullName: "PagSeguro Internet S.A." },
  { code: "323", ispb: "13140088", name: "Mercado Pago", fullName: "Mercado Pago Instituição de Pagamento Ltda." },
  { code: "336", ispb: "13140088", name: "C6 Bank", fullName: "Banco C6 S.A." },
  { code: "341", ispb: "60701190", name: "Itaú Unibanco", fullName: "Itaú Unibanco S.A." },
  { code: "380", ispb: "22610500", name: "PicPay", fullName: "PicPay Instituição de Pagamento S.A." },
  { code: "422", ispb: "58160789", name: "Banco Safra", fullName: "Banco Safra S.A." },
  { code: "623", ispb: "07207996", name: "Banco Pan", fullName: "Banco Pan S.A." },
  { code: "735", ispb: "02685483", name: "Neon", fullName: "Neon Pagamentos S.A." },
  { code: "748", ispb: "01181521", name: "Sicredi", fullName: "Banco Cooperativo Sicredi S.A." },
  { code: "756", ispb: "02038232", name: "Sicoob", fullName: "Banco Cooperativo do Brasil S.A." },
  { code: "208", ispb: "30306294", name: "BTG Pactual", fullName: "Banco BTG Pactual S.A." },
  { code: "102", ispb: "13293225", name: "XP Investimentos", fullName: "XP Investimentos CCTVM S.A." },
];

/** Brand-tinted colors for the initials fallback avatar (BankLogo). Purely
 * cosmetic — used only when no real logo is available. */
export const INSTITUTION_COLORS: Record<string, string> = {
  "001": "#facc15",
  "033": "#ec0000",
  "077": "#ff7a00",
  "104": "#0070ae",
  "212": "#00a651",
  "237": "#cc092f",
  "260": "#820ad1",
  "290": "#00b1a9",
  "323": "#009ee3",
  "336": "#1a1a2e",
  "341": "#ec7000",
  "380": "#21c25e",
  "422": "#5a5a5a",
  "623": "#0c1c8c",
  "655": "#00a99d",
  "735": "#00e08a",
  "748": "#6a2c91",
  "756": "#7dba00",
  "208": "#1b263f",
  "102": "#000000",
};

export function institutionColor(code?: string): string {
  if (code && INSTITUTION_COLORS[code]) return INSTITUTION_COLORS[code];
  return "#5b6b67";
}
