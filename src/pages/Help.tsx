import { useMemo, useState } from "react";
import { ChevronDown, FileText, ShieldCheck, HelpCircle, Upload, Landmark, Wallet, CreditCard } from "lucide-react";
import Header from "../components/layout/Header";
import SearchInput from "../components/ui/SearchInput";
import BankLogo from "../components/institutions/BankLogo";
import ImportWizard from "../components/imports/ImportWizard";
import { useLayoutContext } from "../hooks/useLayoutContext";
import { BANK_HELP_GUIDES, FAQ_ITEMS, type ProductHelpGuide } from "../constants/helpContent";
import { normalizeDescription } from "../utils/normalizeDescription";

const TABS = [
  { key: "banks", label: "Como obter extratos", icon: Landmark },
  { key: "formats", label: "Formatos aceitos", icon: FileText },
  { key: "faq", label: "Dúvidas frequentes", icon: HelpCircle },
  { key: "import", label: "Importação de dados", icon: Upload },
  { key: "security", label: "Segurança e privacidade", icon: ShieldCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ProductGuide({ guide }: { guide: ProductHelpGuide }) {
  return (
    <div className="mt-3 space-y-2">
      <ol className="space-y-1.5 text-xs text-ink-600">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-semibold text-brand-600">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-400">
        Formatos compatíveis: {guide.formats.join(" ou ")} ({guide.recommendedFormat} recomendado).
      </p>
      {guide.notes && <p className="text-xs text-ink-300">{guide.notes}</p>}
    </div>
  );
}

export default function Help() {
  const { onOpenMenu } = useLayoutContext();
  const [tab, setTab] = useState<TabKey>("banks");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openBank, setOpenBank] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<"bankAccount" | "creditCard" | null>(null);
  const [importMode, setImportMode] = useState<"account" | "card" | null>(null);

  const filteredBanks = useMemo(() => {
    const q = normalizeDescription(search);
    if (!q) return BANK_HELP_GUIDES;
    return BANK_HELP_GUIDES.filter((b) => normalizeDescription(b.institutionName).includes(q));
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
              const isOpen = openBank === bank.institutionName;
              return (
                <div key={bank.institutionName} className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
                  <button
                    onClick={() => {
                      setOpenBank(isOpen ? null : bank.institutionName);
                      setOpenProduct(null);
                    }}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <BankLogo name={bank.institutionName} code={bank.institutionCode} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{bank.institutionName}</p>
                      <p className="truncate text-xs text-ink-400">{bank.products.bankAccount.channels.join(" · ")}</p>
                    </div>
                    <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                      <button
                        onClick={() => setOpenProduct(openProduct === "bankAccount" ? null : "bankAccount")}
                        className="flex w-full items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-left text-sm font-semibold text-ink-900"
                      >
                        <span className="flex items-center gap-2"><Wallet size={15} /> Extrato da conta</span>
                        <ChevronDown size={14} className={`transition-transform ${openProduct === "bankAccount" ? "rotate-180" : ""}`} />
                      </button>
                      {openProduct === "bankAccount" && (
                        <>
                          <ProductGuide guide={bank.products.bankAccount} />
                          <button
                            onClick={() => setImportMode("account")}
                            className="w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            Importar extrato agora
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setOpenProduct(openProduct === "creditCard" ? null : "creditCard")}
                        className="flex w-full items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-left text-sm font-semibold text-ink-900"
                      >
                        <span className="flex items-center gap-2"><CreditCard size={15} /> Fatura do cartão</span>
                        <ChevronDown size={14} className={`transition-transform ${openProduct === "creditCard" ? "rotate-180" : ""}`} />
                      </button>
                      {openProduct === "creditCard" && (
                        <>
                          <ProductGuide guide={bank.products.creditCard} />
                          <button
                            onClick={() => setImportMode("card")}
                            className="w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            Importar fatura agora
                          </button>
                        </>
                      )}
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
                Formato estruturado oferecido por muitos bancos brasileiros. Quando o arquivo traz identificadores
                suficientes, o EM DIA sugere o banco e o produto; em caso de dúvida, pede sua confirmação antes de importar.
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
              <h3 className="text-sm font-bold text-ink-900">QIF</h3>
              <p className="mt-1 text-sm text-ink-600">
                Formato mais antigo (Quicken), ainda oferecido por alguns bancos e softwares financeiros. Suportado
                para o caso mais comum (data, valor e descrição).
              </p>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">XLS/XLSX e TXT estruturado</h3>
              <p className="mt-1 text-sm text-ink-600">
                Planilhas e arquivos de texto com colunas são lidos localmente e passam pelo mesmo mapeamento e revisão do CSV.
                PDF continua fora da importação automática porque a estrutura varia demais entre instituições.
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
                <li>2. O EM DIA lê o arquivo no seu próprio dispositivo. Para OFX, sugere banco e conta/cartão quando os identificadores são confiáveis; caso contrário, pede sua escolha.</li>
                <li>3. Lançamentos já existentes aparecem como "Já importada"; pagamentos, estornos e encargos de fatura são identificados e sinalizados para revisão.</li>
                <li>4. Ajuste a categoria de cada item se quiser, confirme e pronto — nada é enviado para fora do seu aparelho antes disso.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-ink-100 bg-surface p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">Categorização e conciliação automática</h3>
              <p className="mt-1 text-sm text-ink-600">
                O EM DIA reconhece padrões comuns (como nomes de aplicativos de transporte ou supermercados) para
                sugerir categorias, e aprende a associação entre uma descrição bancária e uma conta a pagar sempre que
                você confirma um vínculo — da próxima vez, a sugestão vem com mais confiança.
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

      <ImportWizard open={importMode === "account"} onClose={() => setImportMode(null)} mode="account" />
      <ImportWizard open={importMode === "card"} onClose={() => setImportMode(null)} mode="card" />
    </>
  );
}
