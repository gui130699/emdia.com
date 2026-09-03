/** How sure we are about a bank's specific export flow. We only have
 * general knowledge of what banks typically offer (app vs. desktop, OFX
 * support) — never a verified, up-to-date menu path, so every guide below
 * stays "generic" for the actual step-by-step text. This type exists so
 * that changes fixing a confirmed flow later (or feedback from users who
 * confirm one) have somewhere to record that without a code rewrite. */
export type HelpConfidence = "confirmed" | "partially_confirmed" | "generic";

export interface ProductHelpGuide {
  channels: string[];
  steps: string[];
  formats: string[];
  recommendedFormat: "OFX" | "CSV";
  confidence: HelpConfidence;
  notes?: string;
}

export interface BankHelpGuide {
  institutionCode?: string;
  institutionName: string;
  products: {
    bankAccount: ProductHelpGuide;
    creditCard: ProductHelpGuide;
  };
}

/** Deliberately generic, honest steps — we don't have verified, up-to-date
 * menu paths for any bank's app, and a wrong instruction is worse than a
 * general one. Every guide below reuses this same text for that reason;
 * only the channels and recommended format vary by bank. */
const GENERIC_ACCOUNT_STEPS: string[] = [
  "Acesse o aplicativo ou o Internet Banking do seu banco.",
  "Procure no menu por Extrato ou Movimentações da conta.",
  "Escolha o período desejado.",
  "Procure a opção Exportar, Baixar ou Compartilhar arquivo.",
  "Prefira o formato OFX quando disponível; se não houver, use CSV.",
  "Salve o arquivo e importe aqui no EM DIA em Transações → Importar extrato.",
];

const GENERIC_CARD_STEPS: string[] = [
  "Acesse o aplicativo ou o Internet Banking do seu banco.",
  "Procure no menu pela Fatura do cartão de crédito.",
  "Escolha a fatura ou o período desejado.",
  "Procure a opção Exportar, Baixar ou Compartilhar arquivo.",
  "Prefira o formato OFX quando disponível; se não houver, use CSV.",
  "Salve o arquivo e importe aqui no EM DIA em Cartões → Importar fatura.",
];

const GENERIC_NOTE = "Os menus podem variar conforme a versão do aplicativo, tipo de conta ou produto.";

function genericGuide(channels: string[]): BankHelpGuide["products"] {
  return {
    bankAccount: {
      channels,
      steps: GENERIC_ACCOUNT_STEPS,
      formats: ["OFX", "CSV"],
      recommendedFormat: "OFX",
      confidence: "generic",
      notes: GENERIC_NOTE,
    },
    creditCard: {
      channels,
      steps: GENERIC_CARD_STEPS,
      formats: ["OFX", "CSV"],
      recommendedFormat: "OFX",
      confidence: "generic",
      notes: GENERIC_NOTE,
    },
  };
}

export const BANK_HELP_GUIDES: BankHelpGuide[] = [
  { institutionCode: "260", institutionName: "Nubank", products: genericGuide(["App"]) },
  { institutionCode: "341", institutionName: "Itaú", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "001", institutionName: "Banco do Brasil", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "237", institutionName: "Bradesco", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "033", institutionName: "Santander", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "077", institutionName: "Inter", products: genericGuide(["App"]) },
  { institutionCode: "104", institutionName: "Caixa", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "756", institutionName: "Sicoob", products: genericGuide(["App", "Internet Banking"]) },
  { institutionCode: "748", institutionName: "Sicredi", products: genericGuide(["App", "Internet Banking"]) },
  { institutionName: "Outros bancos", products: genericGuide(["App", "Internet Banking"]) },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Se eu importar o mesmo arquivo duas vezes, ele duplica minhas transações?",
    answer:
      "Não. O EM DIA identifica cada lançamento (pelo identificador do banco no OFX, ou por data + valor + descrição no CSV/QIF) e marca como \"Já importada\" tudo que já existe, sem criar duplicidade.",
  },
  {
    question: "Tenho medo de duplicar lançamentos que já cadastrei manualmente.",
    answer:
      "Na tela de revisão, antes de confirmar a importação, você vê o status de cada linha (Novo, Já importada ou Revisar) e pode desmarcar qualquer item antes de importar.",
  },
  {
    question: "Meu banco não está na lista, e agora?",
    answer:
      "Use a opção \"Outros bancos\": o processo de exportar OFX ou CSV é o mesmo — procure por Extrato ou Fatura no app ou Internet Banking do seu banco.",
  },
  {
    question: "Qual formato eu devo escolher, OFX ou CSV?",
    answer:
      "Prefira OFX sempre que o banco oferecer: ele já vem estruturado e o EM DIA reconhece automaticamente a instituição, a conta (ou cartão) e cada movimentação. O CSV também funciona, mas pode pedir que você indique manualmente quais colunas são data, descrição e valor.",
  },
  {
    question: "O EM DIA sabe diferenciar um extrato de conta de uma fatura de cartão?",
    answer:
      "Sim. Ao ler o arquivo OFX, identificamos a estrutura interna (conta bancária ou cartão de crédito). Se o arquivo não bater com a tela em que você está importando, avisamos antes de continuar.",
  },
  {
    question: "Consigo importar sem internet?",
    answer:
      "Sim. A leitura do arquivo, a checagem de duplicidade e a categorização acontecem localmente no seu aparelho. Os dados são sincronizados com a nuvem automaticamente quando a conexão voltar.",
  },
  {
    question: "O EM DIA guarda o arquivo que eu importei?",
    answer:
      "Não guardamos o arquivo original por padrão — apenas os lançamentos que você confirmou na tela de revisão.",
  },
  {
    question: "Consigo desfazer uma importação?",
    answer:
      "Sim, em Importações você encontra o histórico de arquivos importados com a opção Desfazer, que remove os lançamentos criados por aquele arquivo — desde que eles não tenham sido usados para quitar uma conta, fatura ou parcelamento já pagos.",
  },
];
