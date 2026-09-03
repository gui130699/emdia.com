export interface OfxTransaction {
  fitId?: string;
  datePosted: string; // ISO yyyy-MM-dd
  datePostedTime?: string;
  amount: number; // signed: positive = credit/income, negative = debit/expense
  trnType?: string;
  name?: string;
  memo?: string;
  checkNum?: string;
  refNum?: string;
}

export interface ParsedOfx {
  isCreditCard: boolean;
  financialProduct: "bank_account" | "credit_card" | "unknown";
  /** BANKID when present (bank accounts), falling back to <FI><FID> (the
   * signon block's institution id) — credit-card statements often carry
   * only the latter, e.g. Nubank sends FID=260 with no BANKID at all. */
  bankId?: string;
  fid?: string;
  /** The signon block's <ORG> — a regulatory/legal name (e.g. "NU
   * PAGAMENTOS S.A.") used as a secondary identification signal when the
   * numeric id alone doesn't resolve to a known institution. */
  org?: string;
  branchId?: string;
  accountId?: string;
  accountType?: string;
  currency?: string;
  /** LEDGERBAL — the account/card's ledger position, kept separate from
   * availableBalance since they answer different questions (what's posted
   * vs. what you can still spend/withdraw) and must never be conflated. */
  balance?: { amount: number; asOf?: string; asOfDateTime?: string };
  /** AVAILBAL, when the file provides it. */
  availableBalance?: { amount: number; asOf?: string; asOfDateTime?: string };
  /** Only populated from an explicit card-limit field. BALAMT is never a
   * limit and AVAILABLECREDIT is kept separate from the statement balance. */
  creditLimit?: number;
  availableCredit?: number;
  transactions: OfxTransaction[];
}

function ofxDateToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Preserves OFX time and bracketed GMT offset when present. Lexicographic
 * ordering remains stable for timestamps from the same statement/account. */
function ofxDateToIsoDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.trim().match(
    /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})(?:\.\d+)?)?(?:\[([+-]?\d+(?:\.\d+)?)(?::[^\]]+)?\])?/
  );
  if (!match || !match[4]) return undefined;
  const [, year, month, day, hour, minute, second, offsetRaw] = match;
  let offset = "";
  if (offsetRaw !== undefined) {
    const valueAsNumber = Number(offsetRaw);
    if (Number.isFinite(valueAsNumber)) {
      const sign = valueAsNumber < 0 ? "-" : "+";
      const absolute = Math.abs(valueAsNumber);
      const hours = Math.floor(absolute);
      const minutes = Math.round((absolute - hours) * 60);
      offset = `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function ofxNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeUnescapedAmpersands(value: string): string {
  return value.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, "&amp;");
}

/** OFX 1.x (SGML) leaves tags unclosed (`<TAG>value` with no `</TAG>`), while
 * container tags (`<STMTTRN>`) have no inline value. This closes every leaf
 * tag so the result parses as well-formed XML — OFX 2.x files (already
 * closed) pass through unchanged since the regex only matches unclosed ones. */
function toXml(raw: string): string {
  const startIdx = raw.indexOf("<OFX>");
  const body = startIdx >= 0 ? raw.slice(startIdx) : raw;
  return body.replace(/<([A-Za-z0-9.]+)>([^<\r\n]*)\r?\n/g, (match, tag: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return match;
    return `<${tag}>${escapeUnescapedAmpersands(trimmed)}</${tag}>\n`;
  });
}

function text(el: Element | null, tag: string): string | undefined {
  const value = el?.querySelector(tag)?.textContent?.trim();
  return value || undefined;
}

/** Parses an OFX bank or credit-card statement file entirely client-side —
 * the raw file never leaves the browser. */
export function parseOfx(raw: string): ParsedOfx {
  const xmlText = toXml(raw);
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Não foi possível ler este arquivo OFX. Verifique se ele não está corrompido.");
  }

  const bankAcct = doc.querySelector("BANKACCTFROM");
  const ccAcct = doc.querySelector("CCACCTFROM");
  const hasBankStructure = !!bankAcct || !!doc.querySelector("BANKMSGSRSV1, STMTRS");
  const hasCardStructure = !!ccAcct || !!doc.querySelector("CREDITCARDMSGSRSV1, CCSTMTTRNRS, CCSTMTRS");
  const financialProduct = hasCardStructure && !hasBankStructure
    ? "credit_card"
    : hasBankStructure && !hasCardStructure
      ? "bank_account"
      : "unknown";
  const isCreditCard = financialProduct === "credit_card";
  const acctNode = bankAcct ?? ccAcct;

  const fiNode = doc.querySelector("SONRS FI") ?? doc.querySelector("FI");
  const fid = text(fiNode, "FID");
  const org = text(fiNode, "ORG");

  const ledgerBal = doc.querySelector("LEDGERBAL");
  const balanceAmount = text(ledgerBal, "BALAMT");
  const availBal = doc.querySelector("AVAILBAL");
  const availableAmount = text(availBal, "BALAMT");
  const explicitLimit = ofxNumber(
    text(doc.documentElement, "CREDITLIMIT") ?? text(doc.documentElement, "AVAILABLELIMIT")
  );
  const availableCredit = ofxNumber(text(doc.documentElement, "AVAILABLECREDIT"));

  const transactions: OfxTransaction[] = Array.from(doc.querySelectorAll("STMTTRN")).flatMap((node) => {
    const amount = ofxNumber(text(node, "TRNAMT"));
    const dateRaw = text(node, "DTPOSTED");
    const datePosted = ofxDateToIso(dateRaw);
    if (amount === undefined || !datePosted) return [];
    return [{
      fitId: text(node, "FITID"),
      datePosted,
      datePostedTime: ofxDateToIsoDateTime(dateRaw),
      amount,
      trnType: text(node, "TRNTYPE"),
      name: text(node, "NAME"),
      memo: text(node, "MEMO"),
      checkNum: text(node, "CHECKNUM"),
      refNum: text(node, "REFNUM"),
    }];
  });

  const balance = ofxNumber(balanceAmount);
  const available = ofxNumber(availableAmount);
  const balanceDateRaw = text(ledgerBal, "DTASOF");
  const availableDateRaw = text(availBal, "DTASOF");

  return {
    isCreditCard,
    financialProduct,
    bankId: text(acctNode, "BANKID") ?? fid,
    fid,
    org,
    branchId: text(acctNode, "BRANCHID"),
    accountId: text(acctNode, "ACCTID"),
    accountType: text(acctNode, "ACCTTYPE"),
    currency: text(doc.documentElement, "CURDEF"),
    balance: balance !== undefined
      ? { amount: balance, asOf: ofxDateToIso(balanceDateRaw), asOfDateTime: ofxDateToIsoDateTime(balanceDateRaw) }
      : undefined,
    availableBalance: available !== undefined
      ? { amount: available, asOf: ofxDateToIso(availableDateRaw), asOfDateTime: ofxDateToIsoDateTime(availableDateRaw) }
      : undefined,
    creditLimit: explicitLimit,
    availableCredit,
    transactions,
  };
}
