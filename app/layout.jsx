import { Inter, Bebas_Neue } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-inter",
});

const bebasNeue = Bebas_Neue({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-bebas",
});

export const metadata = {
  metadataBase: new URL("https://millenabarreto.com.br"),
  title: "Millena Barreto | Consultoria de Imagem e Estilo",
  description:
    "Consultoria de imagem e estilo personalizada. Descubra sua melhor versão com análise de coloração pessoal e styling individual.",
  keywords: [
    "consultoria de imagem",
    "consultoria de estilo",
    "coloração pessoal",
    "análise de coloração pessoal",
    "estilo pessoal",
    "consultoria de moda",
  ],
  authors: [{ name: "Millena Barreto Pio" }],
  alternates: {
    canonical: "https://millenabarreto.com.br/",
  },
  openGraph: {
    title: "Millena Barreto | Consultoria de Imagem e Estilo",
    description:
      "Transforme sua imagem e estilo com uma consultoria personalizada feita para realçar o que há de melhor em você.",
    url: "https://millenabarreto.com.br/",
    siteName: "Millena Barreto",
    images: [
      {
        url: "https://millenabarreto.com.br/assets/about/img.JPEG",
        width: 1200,
        height: 630,
        alt: "Imagem de destaque da consultoria de imagem de Millena Barreto",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Millena Barreto | Consultoria de Imagem e Estilo",
    description:
      "Descubra sua melhor versão com a consultoria de imagem e estilo de Millena Barreto.",
    images: ["https://millenabarreto.com.br/assets/about/img.JPEG"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "https://millenabarreto.com.br/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="scroll-smooth motion-reduce:scroll-auto">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://millenabarreto.com.br/#business",
              name: "Millena Barreto | Consultoria de Imagem e Estilo",
              url: "https://millenabarreto.com.br",
              logo: "https://millenabarreto.com.br/favicon.ico",
              image: "https://millenabarreto.com.br/assets/about/img.JPEG",
              description:
                "Consultoria de imagem e estilo personalizada. Análise de coloração pessoal e estilo para mulheres que desejam destacar sua autenticidade.",
              address: {
                "@type": "PostalAddress",
                addressCountry: "BR",
              },
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  telephone: "+55-11-98765-4321",
                  contactType: "Atendimento",
                  areaServed: "BR",
                  availableLanguage: "Portuguese",
                },
              ],
            }),
          }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={`antialiased ${inter.variable} ${bebasNeue.variable}`}>
        {/* Google Analytics - GA4 */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-3NYKM6Q9VQ"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3NYKM6Q9VQ');
          `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
