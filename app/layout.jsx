import { Inter, Bebas_Neue } from "next/font/google";
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
  title: "Millena Barreto",
  description: "Consultoria de imagem e estilo, personalizado.",
  icons: {
    icon: "./favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={`antialiased ${inter.variable} ${bebasNeue.variable}`}>
        {children}
      </body>
    </html>
  );
}
