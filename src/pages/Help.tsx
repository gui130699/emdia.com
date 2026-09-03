import { useMemo, useState } from "react";
import { ChevronDown, FileText, ShieldCheck, HelpCircle, Upload, Landmark } from "lucide-react";
import Header from "../components/layout/Header";
import SearchInput from "../components/ui/SearchInput";
import BankLogo from "../components/institutions/BankLogo";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { BANK_GUIDES, FAQ_ITEMS, GENERIC_EXPORT_STEPS } from "../constants/helpContent";
import { normalizeDescription } from "../utils/normalizeDescription";

const TABS = [
  { key: "banks", label: "Como obter extratos", icon: Landmark },
  { key: "formats", label: "Formatos aceitos", icon: FileText },
  { key: "faq", label: "Dúvidas frequentes", icon: HelpCircle },
  { key: "import", label: "Importação de dados", icon: Upload },
  { key: "security", label: "Segurança e privacidade", icon: ShieldCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Help() {
  const { onOpenMenu } = useLayoutContext();
  const [tab, setTab] = useState<TabKey>("banks");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openBank, setOpenBank] = useState<string | null>(null);

  const filteredBanks = useMemo(() => {
    const q = normalizeDescription(search);
    if (!q) return BANK_GUIDES;
    return BANK_GUIDES.filter((b) => normalizeDescription(b.name).includes(q));
  }, [search]);

  const filteredFaq = useMemo(() => {
    const q = normalizeDescription(search);
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (f) => normalizeDescription(f.question).includes(q) || normalizeDescription(f.answer).includes(q)
    );
  }, [search]);

  return (
    <>
      <Header onOpenMenu={onOpenMenu} title="Ajuda" subtitle="Como importar seus extratos e tirar dúvidas sobre o EM DIA." />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar na ajuda..." />

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${
                tab === t.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-100 bg-surface text-ink-600"
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "banks" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBanks.map((bank) => {
              const isOpen = openBank === bank.name;
              return (
                <div key={bank.name} className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                  <button
                    onClick={() => setOpenBank(isOpen ? null : bank.name)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <BankLogo name={bank.name} code={bank.code} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{bank.name}</p>
                      <p className="truncate text-xs text-ink-400">{bank.channels.join(" · ")}</p>
                    </div>
                    <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                      <ol className="space-y-1.5 text-xs text-ink-600">
                        {GENERIC_EXPORT_STEPS.map((step, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-semibold text-brand-600">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="text-xs text-ink-400">
                        Formatos compatíveis: OFX (recomendado) e CSV.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredBanks.length === 0 && (
              <p className="col-span-full text-sm text-ink-400">Nenhum banco encontrado para "{search}".</p>
            )}
          </div>
        )}

        {tab === "formats" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">OFX (recomendado)</h3>
              <p className="mt-1 text-sm text-ink-600">
                Formato estruturado usado por praticamente todos os bancos e cartões brasileiros. O EM DIA identifica
                automaticamente o banco, a conta e cada movimentação a partir dele, com menos chance de erro.
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">CSV (alternativo)</h3>
              <p className="mt-1 text-sm text-ink-600">
                Uma planilha com data, descrição e valor de cada movimentação. O EM DIA tenta reconhecer as colunas
                automaticamente; quando não consegue, pede que você indique qual coluna é qual — isso só acontece uma
                vez por formato de arquivo, o EM DIA lembra da próxima vez.
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">PDF</h3>
              <p className="mt-1 text-sm text-ink-600">
                Ainda não é compatível com a importação automática nesta versão. Use OFX ou CSV sempre que possível.
              </p>
            </div>
          </div>
        )}

        {tab === "faq" && (
          <div className="space-y-2">
            {filteredFaq.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={item.question} className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="flex w-full items-center justify-between gap-3 text-left">
                    <span className="text-sm font-semibold text-ink-900">{item.question}</span>
                    <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="mt-2 text-sm text-ink-600">{item.answer}</p>}
                </div>
              );
            })}
            {filteredFaq.length === 0 && <p className="text-sm text-ink-400">Nenhuma dúvida encontrada para "{search}".</p>}
          </div>
        )}

        {tab === "import" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">Como funciona a importação</h3>
              <ol className="mt-2 space-y-2 text-sm text-ink-600">
                <li>1. Em Transações, clique em "Importar extrato" (ou em Cartões, "Importar fatura") e escolha o arquivo.</li>
                <li>2. O EM DIA lê o arquivo no seu próprio dispositivo e mostra uma prévia com cada lançamento.</li>
                <li>3. Lançamentos já existentes aparecem como "Já importada" e ficam desmarcados automaticamente.</li>
                <li>4. Ajuste a categoria de cada item se quiser, confirme e pronto — nada é enviado para fora do seu aparelho antes disso.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">Categorização automática</h3>
              <p className="mt-1 text-sm text-ink-600">
                O EM DIA reconhece padrões comuns (como nomes de aplicativos de transporte ou supermercados) para
                sugerir categorias. Quando você corrige uma categoria manualmente, pode ensinar o EM DIA a usar essa
                categoria automaticamente da próxima vez.
              </p>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="space-y-3">
            {[
              "Seus arquivos são processados localmente, no seu dispositivo — o conteúdo do extrato não é enviado para servidores externos.",
              "Nunca pedimos sua senha do banco ou do Internet Banking.",
              "Não precisamos acessar seu Internet Banking nem sua conta bancária diretamente.",
              "O EM DIA não armazena o arquivo original importado — apenas os lançamentos que você confirmar.",
            ].map((text) => (
              <div key={text} className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <p className="text-sm text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
