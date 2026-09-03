export interface FinancialInstitution {
  code: string; // COMPE code, e.g. "260" (Nubank), "001" (Banco do Brasil)
  ispb: string;
  name: string; // short/trade name, e.g. "Nubank"
  fullName: string; // legal name, e.g. "Nu Pagamentos S.A."
  logoUrl?: string;
}
