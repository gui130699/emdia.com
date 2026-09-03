/** Strips everything but digits, then prefixes +55 for storage — a Brazilian
 * DDD+number is assumed since that's the only market this form targets. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^55/, "");
  if (!digits) return "";
  return `+55${digits}`;
}

/** Renders a normalized (+55DDNNNNNNNNN) or raw digit string as
 * "(DD) NNNNN-NNNN" / "(DD) NNNN-NNNN" for display and editing. */
export function formatPhoneDisplay(value?: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2, 11);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
