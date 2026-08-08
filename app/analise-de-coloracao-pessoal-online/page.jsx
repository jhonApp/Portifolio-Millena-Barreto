import ColoracaoHero from "@/components/Coloracao/ColoracaoHero";
import ComoFunciona from "@/components/Coloracao/ComoFunciona";
import OQueRecebe from "@/components/Coloracao/OQueRecebe";
import Investimento from "@/components/Coloracao/Investimento";
import FixedMenu from "@/components/FixedMenu";
import Footer from "@/components/Footer";

const URL_PAGINA =
  "https://millenabarreto.com.br/analise-de-coloracao-pessoal-online";
const IMAGEM_OG =
  "https://millenabarreto.com.br/assets/work/coloracao-julia.jpg";
const TITULO = "Análise de Coloração Pessoal Online | Millena Barreto";
const DESCRICAO =
  "Descubra as cores que te valorizam de verdade. Análise de coloração pessoal 100% online, com apresentação ao vivo e dossiê digital personalizado. De R$ 247 por R$ 99,99.";

export const metadata = {
  title: TITULO,
  description: DESCRICAO,
  keywords: [
    "análise de coloração pessoal online",
    "coloração pessoal online",
    "cartela de cores",
    "consultoria de imagem online",
    "descobrir minhas cores",
  ],
  alternates: {
    canonical: URL_PAGINA,
  },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: URL_PAGINA,
    siteName: "Millena Barreto",
    images: [
      {
        url: IMAGEM_OG,
        width: 1200,
        height: 630,
        alt: "Resultado de uma análise de coloração pessoal online",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: [IMAGEM_OG],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Análise de Coloração Pessoal Online",
  serviceType: "Análise de coloração pessoal",
  description: DESCRICAO,
  url: URL_PAGINA,
  image: IMAGEM_OG,
  areaServed: "BR",
  provider: {
    "@type": "LocalBusiness",
    name: "Millena Barreto | Consultoria de Imagem e Estilo",
    url: "https://millenabarreto.com.br",
  },
  offers: {
    "@type": "Offer",
    price: "99.99",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: URL_PAGINA,
  },
};

const AnaliseColoracaoPessoalOnline = () => {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <ColoracaoHero />
        <ComoFunciona />
        <OQueRecebe />
        <Investimento />
        <FixedMenu />
      </main>
      <Footer />
    </>
  );
};

export default AnaliseColoracaoPessoalOnline;
