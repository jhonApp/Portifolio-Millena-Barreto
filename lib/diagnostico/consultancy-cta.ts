import { instagram } from "@/public/consts/instagram";
import { whatsApp } from "@/public/consts/whatsApp";

// The call to action at the end of the result page and of the PDF: one copy, so both say the same thing.

export const CONSULTANCY_CTA = {
  title: "Quer ir mais fundo no seu estilo?",
  intro: "Fale comigo e leve o seu diagnóstico para a vida real:",
  benefits: [
    "Adquira uma análise mais profunda do seu estilo",
    "Tire suas dúvidas sobre a sua paleta",
    "Aprenda a comprar de forma inteligente",
  ],
  whatsappLabel: "Me chama no WhatsApp",
  instagramLabel: "Me siga no Instagram",
  whatsappUrl: `https://wa.me/${whatsApp.telefone}?text=${encodeURIComponent(
    "Olá, Millena! Recebi o meu diagnóstico de estilo e quero saber mais sobre a análise mais profunda.",
  )}`,
  instagramUrl: `https://www.instagram.com/${instagram.conta}`,
  instagramHandle: `@${instagram.conta}`,
} as const;
