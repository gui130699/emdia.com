export interface BankGuide {
  code?: string;
  name: string;
  channels: string[];
}

/** Deliberately generic, honest steps — we don't have verified, up-to-date
 * menu paths for every bank's app, and a wrong instruction is worse than a
 * general one. Every bank guide reuses the same steps for that reason. */
export const GENERIC_EXPORT_STEPS: string[] = [
  "Acesse o aplicativo ou o Internet Banking do seu banco.",
  "Procure no menu por Extrato, Movimentações ou, no caso de cartão de crédito, Fatura.",
  "Procure a opção Exportar, Baixar ou Gerar arquivo.",
  "Escolha o formato OFX, se disponível — é o mais fácil de importar automaticamente. Se não houver, use CSV.",
  "Salve o arquivo no seu celular ou computador e importe aqui no EM DIA em Transações → Importar extrato (ou Cartões → Importar fatura).",
];

export const BANK_GUIDES: BankGuide[] = [
  { code: "260", name: "Nubank", channels: ["App"] },
  { code: "341", name: "Itaú", channels: ["App", "Internet Banking"] },
  { code: "001", name: "Banco do Brasil", channels: ["App", "Internet Banking"] },
  { code: "237", name: "Bradesco", channels: ["App", "Internet Banking"] },
  { code: "033", name: "Santander", channels: ["App", "Internet Banking"] },
  { code: "077", name: "Inter", channels: ["App"] },
  { code: "104", name: "Caixa", channels: ["App", "Internet Banking"] },
  { code: "756", name: "Sicoob", channels: ["App", "Internet Banking"] },
  { code: "748", name: "Sicredi", channels: ["App", "Internet Banking"] },
  { name: "Outros bancos", channels: ["App", "Internet Banking"] },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Se eu importar o mesmo arquivo duas vezes, ele duplica minhas transações?",
    answer:
      "Não. O EM DIA identifica cada lançamento (pelo identificador do banco no OFX, ou por data + valor + descrição no CSV) e marca como \"Já importada\" tudo que já existe, sem criar duplicidade.",
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
      "Prefira OFX sempre que o banco oferecer: ele já vem estruturado e o EM DIA reconhece automaticamente a instituição, a conta e cada movimentação. O CSV também funciona, mas pode pedir que você indique manualmente quais colunas são data, descrição e valor.",
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
      "Sim, em Importações você encontra o histórico de arquivos importados com a opção Desfazer, que remove os lançamentos criados por aquele arquivo — desde que eles não tenham sido usados para quitar uma conta ou fatura já paga.",
  },
];
