import { DELETION_LINK_HOURS, RESULT_TOKEN_DAYS, RETENTION_PAID_MONTHS, RETENTION_UNPAID_DAYS } from "./constants";

// The privacy policy as data (RF-09). The numbers come from constants.ts, the same values the daily
// retention job enforces, so the text and the job cannot drift apart. This is a draft written by the
// team: Millena or a legal adviser must review it before the real launch.

export const PRIVACY_POLICY_TITLE = "Política de Privacidade";
export const PRIVACY_POLICY_UPDATED = "21 de novembro de 2026";
export const CONTROLLER_NAME = "Millena Barreto";

// The operators that process data for the platform. Listed in the policy and checked by the tests.
export const PRIVACY_OPERATORS = [
  { name: "Supabase", purpose: "banco de dados e armazenamento dos arquivos PDF" },
  { name: "Vercel", purpose: "hospedagem do site e dos serviços da plataforma" },
  { name: "AbacatePay", purpose: "processamento do pagamento por Pix" },
  { name: "Resend", purpose: "envio dos e-mails" },
] as const;

export type PolicySection = { id: string; title: string; paragraphs?: string[]; items?: string[] };

/** The sections of the policy. `contactEmail` is the value of PRIVACY_CONTACT_EMAIL. */
export function privacyPolicySections(contactEmail: string): PolicySection[] {
  return [
    {
      id: "quem-somos",
      title: "Quem somos",
      paragraphs: [
        `A plataforma Descubra Seu Estilo é operada por ${CONTROLLER_NAME}, que é a controladora dos dados pessoais tratados aqui.`,
        `Para falar sobre os seus dados, escreva para ${contactEmail}.`,
      ],
    },
    {
      id: "dados-coletados",
      title: "Quais dados coletamos",
      items: [
        "Nome completo, e-mail e WhatsApp, informados por você no cadastro.",
        "A sua preferência de recebimento (e-mail, WhatsApp ou ambos) e o seu consentimento.",
        "As suas respostas às 15 perguntas do questionário.",
        "O diagnóstico gerado e o arquivo PDF correspondente.",
        "O status do pagamento e os identificadores da cobrança. O pagamento é feito por Pix e não coletamos dados de cartão.",
      ],
    },
    {
      id: "finalidades",
      title: "Para que usamos os seus dados",
      items: [
        "Gerar o seu diagnóstico de estilo e o relatório em PDF.",
        "Enviar o diagnóstico para o seu e-mail e permitir que você acesse o resultado por um link pessoal.",
        "Confirmar o seu pagamento e manter o registro financeiro exigido por lei.",
        "Atender você quando precisar de ajuda.",
      ],
    },
    {
      id: "prazos",
      title: "Por quanto tempo guardamos",
      items: [
        `Cadastro e respostas sem pagamento: apagados depois de ${RETENTION_UNPAID_DAYS} dias.`,
        `Dados de quem comprou (cadastro, respostas, diagnóstico e PDF): apagados depois de ${RETENTION_PAID_MONTHS} meses.`,
        `O link do resultado vale por ${RESULT_TOKEN_DAYS} dias. Você pode pedir um novo link quando quiser, enquanto os seus dados existirem.`,
        `O link de confirmação de exclusão vale por ${DELETION_LINK_HOURS} horas.`,
        "O registro do pagamento (número do pedido, valor e data) fica guardado sem ligação com você, para fins fiscais e de auditoria.",
      ],
    },
    {
      id: "direitos",
      title: "Os seus direitos",
      paragraphs: ["Pela Lei Geral de Proteção de Dados (LGPD), você pode:"],
      items: [
        "saber quais dados temos sobre você e para que os usamos;",
        "corrigir dados incompletos ou errados;",
        "pedir a exclusão dos seus dados;",
        "retirar o seu consentimento;",
        "obter informações sobre com quem compartilhamos os dados.",
      ],
    },
    {
      id: "compartilhamento",
      title: "Com quem compartilhamos",
      paragraphs: [
        "Usamos serviços de terceiros, chamados operadores, que tratam os dados em nosso nome e só para a finalidade indicada:",
      ],
      items: PRIVACY_OPERATORS.map((operator) => `${operator.name}: ${operator.purpose}.`),
    },
    {
      id: "seguranca",
      title: "Como protegemos",
      paragraphs: [
        "O acesso aos dados é restrito. O seu resultado só abre com o link pessoal enviado para você, e o PDF é entregue por um endereço temporário. Nenhuma outra cliente vê as suas respostas ou o seu resultado.",
      ],
    },
    {
      id: "exclusao",
      title: "Como pedir a exclusão",
      paragraphs: [
        "Informe o e-mail usado na compra na página de exclusão. Enviaremos um link de confirmação e, depois da sua confirmação, apagaremos os seus dados e avisaremos por e-mail.",
      ],
    },
    {
      id: "atualizacoes",
      title: "Atualizações",
      paragraphs: [`Esta política foi atualizada em ${PRIVACY_POLICY_UPDATED}. Mudanças importantes serão avisadas nesta página.`],
    },
  ];
}
