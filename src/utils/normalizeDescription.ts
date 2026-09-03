/** Lowercases, strips accents/diacritics and collapses punctuation/whitespace
 * so "PAG*Giassi Supermercado" and "pag giassi supermercado" match. */
export function normalizeDescription(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
