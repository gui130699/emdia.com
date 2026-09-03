export interface OfxTransaction {
  fitId?: string;
  datePosted: string; // ISO yyyy-MM-dd
  amount: number; // signed: positive = credit/income, negative = debit/expense
  trnType?: string;
  name?: string;
  memo?: string;
  checkNum?: string;
  refNum?: string;
}

export interface ParsedOfx {
  isCreditCard: boolean;
  /** BANKID when present (bank accounts), falling back to <FI><FID> (the
   * signon block's institution id) — credit-card statements often carry
   * only the latter, e.g. Nubank sends FID=260 with no BANKID at all. */
  bankId?: string;
  /** The signon block's <ORG> — a regulatory/legal name (e.g. "NU
   * PAGAMENTOS S.A.") used as a secondary identification signal when the
   * numeric id alone doesn't resolve to a known institution. */
  org?: string;
  branchId?: string;
  accountId?: string;
  accountType?: string;
  /** LEDGERBAL — the account/card's ledger position, kept separate from
   * availableBalance since they answer different questions (what's posted
   * vs. what you can still spend/withdraw) and must never be conflated. */
  balance?: { amount: number; asOf?: string };
  /** AVAILBAL, when the file provides it. */
  availableBalance?: { amount: number; asOf?: string };
  transactions: OfxTransaction[];
}

function ofxDateToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
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
  const isCreditCard = !bankAcct && !!ccAcct;
  const acctNode = bankAcct ?? ccAcct;

  const fiNode = doc.querySelector("SONRS FI") ?? doc.querySelector("FI");
  const fid = text(fiNode, "FID");
  const org = text(fiNode, "ORG");

  const ledgerBal = doc.querySelector("LEDGERBAL");
  const balanceAmount = text(ledgerBal, "BALAMT");
  const availBal = doc.querySelector("AVAILBAL");
  const availableAmount = text(availBal, "BALAMT");

  const transactions: OfxTransaction[] = Array.from(doc.querySelectorAll("STMTTRN")).map((node) => {
    const amountText = text(node, "TRNAMT") ?? "0";
    return {
      fitId: text(node, "FITID"),
      datePosted: ofxDateToIso(text(node, "DTPOSTED")) ?? "",
      amount: Number(amountText.replace(",", ".")) || 0,
      trnType: text(node, "TRNTYPE"),
      name: text(node, "NAME"),
      memo: text(node, "MEMO"),
      checkNum: text(node, "CHECKNUM"),
      refNum: text(node, "REFNUM"),
    };
  });

  return {
    isCreditCard,
    bankId: text(acctNode, "BANKID") ?? fid,
    org,
    branchId: text(acctNode, "BRANCHID"),
    accountId: text(acctNode, "ACCTID"),
    accountType: text(acctNode, "ACCTTYPE"),
    balance: balanceAmount
      ? { amount: Number(balanceAmount.replace(",", ".")) || 0, asOf: ofxDateToIso(text(ledgerBal, "DTASOF")) }
      : undefined,
    availableBalance: availableAmount
      ? { amount: Number(availableAmount.replace(",", ".")) || 0, asOf: ofxDateToIso(text(availBal, "DTASOF")) }
      : undefined,
    transactions: transactions.filter((t) => t.datePosted),
  };
}
