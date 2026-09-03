import type { FinancialInstitution } from "../types/institution";
import { FALLBACK_INSTITUTIONS, TRADE_NAME_OVERRIDES } from "../constants/institutions";

const CACHE_KEY = "emdia:institutions:cache:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1x por dia
const SOURCE_URL = "https://brasilapi.com.br/api/banks/v1";

interface CacheShape {
  fetchedAt: number;
  data: FinancialInstitution[];
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

function writeCache(data: FinancialInstitution[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {
    /* storage full/unavailable — cache is a nice-to-have, not required */
  }
}

interface BrasilApiBank {
  ispb: string;
  name: string;
  code: number | null;
  fullName: string;
  logo_url?: string | null;
}

async function fetchRemoteList(): Promise<FinancialInstitution[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(SOURCE_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const raw = (await res.json()) as BrasilApiBank[];
    return raw
      .filter((b) => b.code != null && b.name)
      .map((b) => {
        const code = String(b.code).padStart(3, "0");
        return {
          code,
          ispb: b.ispb,
          // The official STR list uses regulatory names (e.g. "NU PAGAMENTOS -
          // IP"); prefer the recognizable trade name people actually search for.
          name: TRADE_NAME_OVERRIDES[code] ?? b.name,
          fullName: b.fullName || b.name,
          logoUrl: b.logo_url ?? undefined,
        };
      });
  } finally {
    clearTimeout(timeout);
  }
}

let inFlight: Promise<FinancialInstitution[]> | null = null;

async function loadAll(): Promise<FinancialInstitution[]> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!inFlight) {
    inFlight = fetchRemoteList()
      .then((list) => {
        writeCache(list);
        return list;
      })
      .catch(() => cached?.data ?? FALLBACK_INSTITUTIONS)
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

export const financialInstitutionService = {
  /** Warms the cache without blocking the caller. */
  preload(): void {
    void loadAll();
  },

  async searchInstitutions(query: string, limit = 8): Promise<FinancialInstitution[]> {
    const q = normalize(query);
    if (!q) return [];

    const all = await loadAll();
    const isCodeQuery = /^\d+$/.test(q);

    const results = all.filter((inst) => {
      if (isCodeQuery) return inst.code.includes(q);
      return normalize(inst.name).includes(q) || normalize(inst.fullName).includes(q);
    });

    results.sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    });

    return results.slice(0, limit);
  },

  async getInstitutionByCode(code: string): Promise<FinancialInstitution | undefined> {
    const all = await loadAll();
    return all.find((inst) => inst.code === code.padStart(3, "0"));
  },

  async getInstitutionByName(name: string): Promise<FinancialInstitution | undefined> {
    const all = await loadAll();
    const q = normalize(name);
    return all.find((inst) => normalize(inst.name) === q);
  },
};
