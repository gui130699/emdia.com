/** Deterministic, dependency-free string hash (djb2) — enough entropy for a
 * dedup fingerprint, not intended for cryptographic use. */
export function fingerprint(...parts: (string | number)[]): string {
  const input = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
