# Página Análise de Coloração Pessoal Online — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a landing page de venda em `/analise-de-coloracao-pessoal-online`, seguindo a identidade visual do site, com CTA para checkout externo e fallback para WhatsApp.

**Architecture:** Primeira rota secundária do site. A página é um **server component** (exporta `metadata` e JSON-LD) que compõe quatro componentes de seção em `components/Coloracao/`. A home ganha dois pontos de entrada para ela. Nenhuma seção existente da home é refatorada.

**Tech Stack:** Next.js 14.2.14 (App Router), React 18, Tailwind CSS 3.4, `lucide-react`, `react-icons`. Componentes em `.jsx`; constantes em `.ts`.

**Spec:** [docs/superpowers/specs/2026-08-08-analise-coloracao-pessoal-online-design.md](../specs/2026-08-08-analise-coloracao-pessoal-online-design.md)

## Global Constraints

- **Sem framework de teste.** O projeto não tem jest, vitest, RTL, Playwright nem config de ESLint. O ciclo de verificação de cada tarefa é `npm run build` (deve terminar sem erro) mais conferência visual em `npm run dev`. Não instale infraestrutura de teste — está fora do escopo acordado.
- **Idioma:** todo texto visível ao usuário em português do Brasil. Nomes de componentes e props em português quando descrevem conteúdo (`passos`, `itens`, `titulo`, `descricao`), seguindo o que o repo já faz em [Services.jsx](../../../components/Services.jsx).
- **Cores:** apenas os tokens do Tailwind já configurados — `primary` (`#10151f`), `secondary` (`#475467`), `accent` (`#937dad`). Nunca hex solto.
- **Atenção com `accent-hover`:** em [tailwind.config.js](../../../tailwind.config.js) `accent.hover` tem o **mesmo valor** de `accent.DEFAULT`, então `hover:bg-accent-hover` não produz efeito visual nenhum. Use `hover:brightness-110` nos botões novos.
- **Classes utilitárias existentes:** use `.h1`, `.h2`, `.h3`, `.lead` e `shadow-custom` de [globals.css](../../../app/globals.css) em vez de recriar estilos.
- **Preço:** exatamente `R$ 247,00` (riscado) e `R$ 99,99`. Meio de pagamento: "Pix ou cartão de crédito".
- **Rota canônica:** `https://millenabarreto.com.br/analise-de-coloracao-pessoal-online`
- **Sem contador regressivo.** O selo de urgência é texto estático.
- Cada tarefa termina com um commit próprio.

---

### Task 1: Rota, metadata e Hero

Entrega a página acessível em `/analise-de-coloracao-pessoal-online` com o Hero renderizando. Inclui a correção do `"use client"` em `FixedMenu`, que é pré-requisito para a página existir como server component.

**Files:**
- Create: `components/Coloracao/ColoracaoHero.jsx`
- Create: `app/analise-de-coloracao-pessoal-online/page.jsx`
- Modify: `components/FixedMenu.jsx:1`

**Interfaces:**
- Consumes: `Header` de `components/Header.jsx` (já é `"use client"`), `Footer` de `components/Footer.jsx`, `FixedMenu` (default export `FloatingButtons`) de `components/FixedMenu.jsx`
- Produces: `ColoracaoHero` (default export, sem props). A página exporta `metadata`. O Hero contém `<a href="#investimento">`, cujo alvo só passa a existir na Task 4.

- [ ] **Step 1: Corrigir o `"use client"` faltante em FixedMenu**

[components/FixedMenu.jsx](../../../components/FixedMenu.jsx) usa `useState` e `useEffect` mas não declara `"use client"`. Hoje isso passa porque [app/page.jsx](../../../app/page.jsx) é `"use client"` e torna toda a árvore client. A página nova é server component, então sem essa correção o build quebra com `You're importing a component that needs useState`.

Adicione a diretiva como **primeira linha** do arquivo, antes dos imports:

```jsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
```

- [ ] **Step 2: Confirmar que a home continua compilando**

Run: `npm run build`
Expected: `Compiled successfully`, com `/` listada nas rotas. A diretiva não muda comportamento algum na home — o componente já era client na prática.

- [ ] **Step 3: Criar o componente do Hero**

Create `components/Coloracao/ColoracaoHero.jsx`:

```jsx
import Image from "next/image";
import Header from "@/components/Header";

const ColoracaoHero = () => {
  return (
    <section className="relative bg-accent/10 pb-12 xl:pb-0 xl:h-[720px]">
      <Header />
      <div className="container mx-auto h-full">
        <div className="flex flex-col xl:flex-row items-center h-full gap-8">
          {/* conteúdo */}
          <div className="flex-1 flex flex-col items-center xl:items-start justify-center text-center xl:text-left pt-[140px] xl:pt-0">
            <span className="inline-block bg-accent text-white text-sm font-semibold tracking-[6px] px-4 py-1 rounded-full mb-6">
              ONLINE
            </span>
            <h1 className="h1 mb-4">
              Análise de <span className="text-accent">Coloração Pessoal</span>
            </h1>
            <p className="lead max-w-[520px] mb-8">
              Descubra as cores que te valorizam de verdade. Uma análise
              completa, feita 100% à distância, com apresentação ao vivo e
              dossiê digital personalizado.
            </p>
            <a
              href="#investimento"
              className="inline-flex items-center justify-center bg-accent text-white font-bold text-lg px-8 py-4 rounded-full shadow-lg hover:brightness-110 transition-all"
            >
              Quero descobrir minha cartela
            </a>
          </div>

          {/* imagem */}
          <div className="flex-1 flex items-end justify-center self-stretch">
            <Image
              src="/assets/hero/mihOficial.png"
              width={620}
              height={720}
              quality={100}
              priority
              className="object-contain max-h-[400px] xl:max-h-full"
              alt="Millena Barreto, consultora de imagem e coloração pessoal"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ColoracaoHero;
```

O `pt-[140px]` no mobile abre espaço para o `<Header />`, que é `absolute` com `py-8` (veja [Header.jsx:6](../../../components/Header.jsx#L6)).

- [ ] **Step 4: Criar a página com metadata e JSON-LD**

Create `app/analise-de-coloracao-pessoal-online/page.jsx`:

```jsx
import ColoracaoHero from "@/components/Coloracao/ColoracaoHero";
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
        <FixedMenu />
      </main>
      <Footer />
    </>
  );
};

export default AnaliseColoracaoPessoalOnline;
```

- [ ] **Step 5: Verificar o build e a rota**

Run: `npm run build`
Expected: `Compiled successfully` e a lista de rotas incluindo `/analise-de-coloracao-pessoal-online`.

- [ ] **Step 6: Conferir visualmente**

Run: `npm run dev` e abra `http://localhost:3000/analise-de-coloracao-pessoal-online`

Confira:
- O logo "Millena Barreto" aparece no topo e leva para `/`
- O H1 quebra em duas linhas com "Coloração Pessoal" em lilás
- A foto aparece à direita em 1440px e abaixo do texto em 375px
- Nada de scroll horizontal em 375px
- O rodapé escuro aparece no fim
- Os botões flutuantes de WhatsApp/Instagram surgem depois de rolar ~150px

- [ ] **Step 7: Commit**

```bash
git add components/FixedMenu.jsx components/Coloracao/ColoracaoHero.jsx app/analise-de-coloracao-pessoal-online/page.jsx
git commit -m "feat: rota e hero da página de coloração pessoal online"
```

---

### Task 2: Seção "Como funciona"

**Files:**
- Create: `components/Coloracao/ComoFunciona.jsx`
- Modify: `app/analise-de-coloracao-pessoal-online/page.jsx`

**Interfaces:**
- Consumes: nada de tarefas anteriores além da página criada na Task 1
- Produces: `ComoFunciona` (default export, sem props)

- [ ] **Step 1: Criar o componente**

Create `components/Coloracao/ComoFunciona.jsx`:

```jsx
const passos = [
  {
    titulo: "Você envia sua foto",
    descricao: "Seguindo as orientações que eu te passo.",
  },
  {
    titulo: "Eu faço sua análise",
    descricao:
      "Uso um material digital que simula os tecidos da análise presencial para identificar as cores que mais harmonizam com você e definir a sua cartela.",
  },
  {
    titulo: "Apresentação ao vivo no Meet",
    descricao:
      "Explico seu resultado, suas melhores cores e dou orientações sobre maquiagem, acessórios, metais e cabelo.",
  },
  {
    titulo: "Você recebe seu dossiê",
    descricao:
      "Um dossiê digital personalizado para consultar sempre que precisar.",
  },
];

const ComoFunciona = () => {
  return (
    <section
      className="py-16 xl:py-24"
      aria-labelledby="como-funciona-heading"
    >
      <div className="container mx-auto">
        <h2
          id="como-funciona-heading"
          className="h2 text-center mb-4"
        >
          Como funciona a{" "}
          <span className="text-accent">análise online</span>
        </h2>
        <p className="text-center max-w-[640px] mx-auto mb-12">
          São quatro etapas simples, do envio da foto até o seu dossiê pronto.
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {passos.map((passo, index) => (
            <li
              key={passo.titulo}
              className="bg-white shadow-custom rounded-lg p-6"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white font-primary text-2xl mb-4">
                {index + 1}
              </span>
              <h3 className="h3 mb-2">{passo.titulo}</h3>
              <p className="text-[15px]">{passo.descricao}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default ComoFunciona;
```

- [ ] **Step 2: Renderizar na página**

Em `app/analise-de-coloracao-pessoal-online/page.jsx`, adicione o import junto aos outros:

```jsx
import ComoFunciona from "@/components/Coloracao/ComoFunciona";
```

E o componente logo depois do Hero:

```jsx
      <main>
        <ColoracaoHero />
        <ComoFunciona />
        <FixedMenu />
      </main>
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: `Compiled successfully`

- [ ] **Step 4: Conferir visualmente**

Run: `npm run dev` e recarregue a página.

Confira:
- Quatro cards numerados de 1 a 4, nessa ordem
- 4 colunas em 1440px, 2 em 768px, 1 em 375px
- Os círculos numerados são lilás com número branco em Bebas Neue

- [ ] **Step 5: Commit**

```bash
git add components/Coloracao/ComoFunciona.jsx app/analise-de-coloracao-pessoal-online/page.jsx
git commit -m "feat: seção como funciona na página de coloração"
```

---

### Task 3: Seção "O que você recebe"

**Files:**
- Create: `components/Coloracao/OQueRecebe.jsx`
- Modify: `app/analise-de-coloracao-pessoal-online/page.jsx`

**Interfaces:**
- Consumes: `lucide-react` (já em `package.json`, versão `^0.451.0`)
- Produces: `OQueRecebe` (default export, sem props)

- [ ] **Step 1: Criar o componente**

Create `components/Coloracao/OQueRecebe.jsx`:

```jsx
import { Brush, FileText, Gem, Palette, Scissors, Shirt } from "lucide-react";

const itens = [
  {
    Icone: FileText,
    titulo: "Dossiê digital",
    descricao: "Material completo e personalizado com sua análise.",
  },
  {
    Icone: Palette,
    titulo: "Cartela de cores",
    descricao: "Sua cartela exclusiva com todas as cores que te valorizam.",
  },
  {
    Icone: Shirt,
    titulo: "Dicas de looks",
    descricao:
      "Sugestões práticas para montar looks incríveis no seu dia a dia.",
  },
  {
    Icone: Brush,
    titulo: "Maquiagem correta",
    descricao: "Cores ideais de maquiagem que realçam sua beleza natural.",
  },
  {
    Icone: Gem,
    titulo: "Acessórios",
    descricao:
      "Acessórios que harmonizam com sua cartela e destacam seu estilo.",
  },
  {
    Icone: Scissors,
    titulo: "Cores de cabelo",
    descricao: "Tons de cabelo que iluminam e trazem mais harmonia para você.",
  },
];

const OQueRecebe = () => {
  return (
    <section
      className="bg-accent/10 py-16 xl:py-24"
      aria-labelledby="o-que-recebe-heading"
    >
      <div className="container mx-auto">
        <h2 id="o-que-recebe-heading" className="h2 text-center mb-12">
          O que você <span className="text-accent">recebe</span>
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {itens.map(({ Icone, titulo, descricao }) => (
            <li
              key={titulo}
              className="bg-white shadow-custom rounded-lg p-6"
            >
              <Icone
                className="w-12 h-12 text-accent mb-4"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h3 className="h3 mb-2">{titulo}</h3>
              <p className="text-[15px]">{descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default OQueRecebe;
```

- [ ] **Step 2: Renderizar na página**

Em `app/analise-de-coloracao-pessoal-online/page.jsx`, adicione o import:

```jsx
import OQueRecebe from "@/components/Coloracao/OQueRecebe";
```

E o componente depois de `ComoFunciona`:

```jsx
      <main>
        <ColoracaoHero />
        <ComoFunciona />
        <OQueRecebe />
        <FixedMenu />
      </main>
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: `Compiled successfully`

Se algum ícone não existir nessa versão do `lucide-react`, o build falha com `'X' is not exported from 'lucide-react'`. Nesse caso substitua: `Brush` → `Palette`, `Gem` → `Sparkles`, `Shirt` → `ShoppingBag`. Não invente nomes de ícone sem confirmar no build.

- [ ] **Step 4: Conferir visualmente**

Run: `npm run dev` e recarregue.

Confira:
- Seis cards com ícone lilás de traço fino
- 3 colunas em 1440px, 2 em 768px, 1 em 375px
- O fundo lilás claro da seção contrasta com os cards brancos

- [ ] **Step 5: Commit**

```bash
git add components/Coloracao/OQueRecebe.jsx app/analise-de-coloracao-pessoal-online/page.jsx
git commit -m "feat: seção o que você recebe na página de coloração"
```

---

### Task 4: Bloco de investimento, checkout e scroll suave

Entrega o bloco de preço escuro, o CTA com fallback e faz a âncora do Hero funcionar de fato.

**Files:**
- Create: `public/consts/checkout.ts`
- Create: `components/Coloracao/ButtonCheckout.jsx`
- Create: `components/Coloracao/Investimento.jsx`
- Modify: `app/analise-de-coloracao-pessoal-online/page.jsx`
- Modify: `app/layout.jsx:68`

**Interfaces:**
- Consumes: `whatsApp` de `public/consts/whatsApp.ts` (formato `{ telefone: string, mensagem: string }`)
- Produces:
  - `checkout` — objeto `{ url: string, mensagemWhatsApp: string }`
  - `ButtonCheckout` — default export, prop `{ label: string }`
  - `Investimento` — default export, sem props, renderiza `<section id="investimento">`

- [ ] **Step 1: Criar a constante de checkout**

Create `public/consts/checkout.ts`:

```ts
export const checkout = {
  // Cole aqui a URL do checkout (Hotmart, Kiwify, Mercado Pago, link de Pix...).
  // Enquanto estiver vazia, os botões de compra abrem o WhatsApp.
  url: "",
  mensagemWhatsApp:
    "Olá! Quero fazer a Análise de Coloração Pessoal Online por R$ 99,99",
};
```

- [ ] **Step 2: Criar o botão de checkout com fallback**

Create `components/Coloracao/ButtonCheckout.jsx`:

```jsx
import { FaWhatsapp } from "react-icons/fa";
import { checkout } from "@/public/consts/checkout";
import { whatsApp } from "@/public/consts/whatsApp";

const ButtonCheckout = ({ label }) => {
  const temCheckout = checkout.url.trim().length > 0;
  const href = temCheckout
    ? checkout.url
    : `https://wa.me/${whatsApp.telefone}?text=${encodeURIComponent(
        checkout.mensagemWhatsApp
      )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 bg-accent text-white font-bold text-lg px-8 py-4 rounded-full shadow-lg hover:brightness-110 transition-all"
    >
      {!temCheckout && <FaWhatsapp className="text-2xl" />}
      {label}
    </a>
  );
};

export default ButtonCheckout;
```

Enquanto não há checkout, o ícone do WhatsApp aparece para deixar claro para onde o clique leva. Quando `url` for preenchida, o ícone some sozinho.

- [ ] **Step 3: Criar o bloco de investimento**

Create `components/Coloracao/Investimento.jsx`:

```jsx
import ButtonCheckout from "./ButtonCheckout";

const Investimento = () => {
  return (
    <section
      id="investimento"
      className="py-16 xl:py-24 scroll-mt-8"
      aria-labelledby="investimento-heading"
    >
      <div className="container mx-auto">
        <div className="bg-primary rounded-2xl px-6 py-12 xl:py-16 text-center max-w-[880px] mx-auto">
          <span className="inline-block bg-accent text-white text-sm font-semibold px-4 py-1 rounded-full mb-6">
            ⏳ Oferta por tempo limitado
          </span>
          <h2 id="investimento-heading" className="h2 text-white mb-8">
            Investimento
          </h2>
          <p className="text-white/60 text-xl mb-1">
            De <span className="line-through">R$ 247,00</span>
          </p>
          <p className="text-white/80 text-lg mb-2">Por apenas</p>
          <p className="font-primary text-white text-[72px] xl:text-[110px] leading-none mb-3">
            R$ 99,99
          </p>
          <p className="text-white/70 mb-10">Pix ou cartão de crédito</p>
          <ButtonCheckout label="Quero minha análise" />
        </div>
      </div>
    </section>
  );
};

export default Investimento;
```

A classe `.h2` aplica `text-primary` na camada `base` do Tailwind; `text-white` é utilitário e ganha da base, então o título fica branco. O `scroll-mt-8` evita que a âncora do Hero pare com o bloco colado no topo da tela.

- [ ] **Step 4: Renderizar na página**

Em `app/analise-de-coloracao-pessoal-online/page.jsx`, adicione o import:

```jsx
import Investimento from "@/components/Coloracao/Investimento";
```

E o componente depois de `OQueRecebe`:

```jsx
      <main>
        <ColoracaoHero />
        <ComoFunciona />
        <OQueRecebe />
        <Investimento />
        <FixedMenu />
      </main>
```

- [ ] **Step 5: Ligar o scroll suave**

Em [app/layout.jsx:68](../../../app/layout.jsx#L68), adicione a classe na tag `<html>`:

```jsx
    <html lang="pt-BR" className="scroll-smooth">
```

- [ ] **Step 6: Verificar o build**

Run: `npm run build`
Expected: `Compiled successfully`

- [ ] **Step 7: Conferir o comportamento**

Run: `npm run dev` e recarregue a página.

Confira:
- Clicar em "Quero descobrir minha cartela" no Hero rola suavemente até o bloco escuro
- O bloco é escuro (`#10151f`) com `R$ 99,99` grande em Bebas Neue
- `R$ 247,00` aparece riscado e mais apagado
- Com `checkout.url` vazia, o botão "Quero minha análise" mostra o ícone do WhatsApp e abre `wa.me/5511988652315` com a mensagem sobre os R$ 99,99

Depois teste o outro caminho: preencha temporariamente `url: "https://exemplo.com/checkout"` em `public/consts/checkout.ts`, recarregue e confirme que o ícone do WhatsApp some e o link aponta para `exemplo.com`. **Reverta a URL para `""` antes do commit.**

- [ ] **Step 8: Commit**

```bash
git add public/consts/checkout.ts components/Coloracao/ButtonCheckout.jsx components/Coloracao/Investimento.jsx app/analise-de-coloracao-pessoal-online/page.jsx app/layout.jsx
git commit -m "feat: bloco de investimento com checkout e fallback para whatsapp"
```

---

### Task 5: Sitemap e GA4 no layout

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/layout.jsx`
- Modify: `app/page.jsx:1-32`

**Interfaces:**
- Consumes: nada de tarefas anteriores
- Produces: nada consumido por tarefas seguintes

- [ ] **Step 1: Adicionar a rota ao sitemap**

Substitua o conteúdo de `app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://millenabarreto.com.br/',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://millenabarreto.com.br/analise-de-coloracao-pessoal-online',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ]
}
```

- [ ] **Step 2: Mover o GA4 para o layout**

Em `app/layout.jsx`, adicione o import no topo do arquivo:

```jsx
import Script from "next/script";
```

E os dois `<Script>` dentro do `<body>`, logo antes de `{children}`:

```jsx
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
```

- [ ] **Step 3: Remover o GA4 duplicado da home**

Em `app/page.jsx`, apague o `import Script from "next/script";` (linha 2) e todo o bloco dos dois `<Script>` (linhas 16 a 32). O componente deve começar direto no fragmento com `<main id="inicio">`:

```jsx
"use client";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import About from "@/components/About";
import Work from "@/components/Work/Work";
import Contact from "@/components/Contact";
import FixedMenu from "@/components/FixedMenu";
import Testimonial from "@/components/Testimonial";
import Footer from "@/components/Footer";
import Palestra from "@/components/Palestra";

const Home = () => {
  return (
    <>
      <main id="inicio">
        <Hero />
        <FixedMenu />
        <Services />
        <About />
        <Work />
        <Testimonial />
        <Palestra />
        <Contact />
      </main>
      <Footer />
    </>
  );
};

export default Home;
```

Se o `Script` continuar na home **e** no layout, o `gtag('config')` roda duas vezes e a home passa a contar pageview duplicado. Confirme que sobrou só uma cópia.

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: `Compiled successfully`, com `/`, `/analise-de-coloracao-pessoal-online` e `/sitemap.xml` na lista de rotas.

- [ ] **Step 5: Conferir sitemap e GA**

Run: `npm run dev`

- Abra `http://localhost:3000/sitemap.xml` — as duas URLs devem aparecer
- Abra a home e a página nova; em cada uma, no DevTools → Network, filtre por `gtag` e confirme **uma** requisição para `googletagmanager.com` por página
- No DevTools → Console, rode `dataLayer.length` na home; o valor não deve dobrar em relação ao comportamento antigo

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts app/layout.jsx app/page.jsx
git commit -m "chore: adiciona rota ao sitemap e move GA4 para o layout"
```

---

### Task 6: Pontos de entrada na home

**Files:**
- Create: `components/Coloracao/FaixaColoracao.jsx`
- Modify: `components/Hero.jsx:27-30`
- Modify: `app/page.jsx`

**Interfaces:**
- Consumes: `next/link`
- Produces: `FaixaColoracao` (default export, sem props)

- [ ] **Step 1: Criar a faixa de destaque**

Create `components/Coloracao/FaixaColoracao.jsx`:

```jsx
import Link from "next/link";

const FaixaColoracao = () => {
  return (
    <section className="bg-accent/10 py-10" aria-labelledby="faixa-coloracao-heading">
      <div className="container mx-auto">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 text-center xl:text-left">
          <div>
            <h2 id="faixa-coloracao-heading" className="h3 mb-1">
              Análise de Coloração Pessoal Online
            </h2>
            <p className="text-[15px]">
              De <span className="line-through">R$ 247,00</span> por{" "}
              <strong className="text-accent text-lg">R$ 99,99</strong> · oferta
              por tempo limitado
            </p>
          </div>
          <Link
            href="/analise-de-coloracao-pessoal-online"
            className="inline-flex items-center justify-center bg-accent text-white font-bold text-lg px-6 py-3 rounded-full shadow-lg hover:brightness-110 transition-all whitespace-nowrap"
          >
            Quero descobrir minha cartela
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FaixaColoracao;
```

- [ ] **Step 2: Renderizar a faixa na home**

Em `app/page.jsx`, adicione o import:

```jsx
import FaixaColoracao from "@/components/Coloracao/FaixaColoracao";
```

E o componente logo depois de `<Services />`:

```jsx
        <Services />
        <FaixaColoracao />
        <About />
```

- [ ] **Step 3: Adicionar o botão no Hero da home**

Em [components/Hero.jsx](../../../components/Hero.jsx), adicione o import junto aos outros:

```jsx
import Link from "next/link";
```

E substitua o bloco de botões das linhas 27-30 por:

```jsx
          <div className="z-[99] mt-6 flex flex-col sm:flex-row sm:flex-wrap justify-center xl:justify-start gap-4">
            <Link
              href="/analise-de-coloracao-pessoal-online"
              className="inline-flex items-center justify-center bg-accent text-white font-bold text-lg px-3 py-3 rounded-full shadow-lg hover:brightness-110 transition-all"
            >
              Quero descobrir minha cartela
            </Link>
            <ButtonInstagram />
            <ButtonWhatsApp />
          </div>
```

O `sm:flex-wrap` evita que os três botões estourem a largura em tablet.

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: `Compiled successfully`

- [ ] **Step 5: Conferir a home**

Run: `npm run dev` e abra `http://localhost:3000`

Confira:
- Três botões no Hero; o lilás vem primeiro e leva para a página nova
- Em 768px os botões quebram linha em vez de estourar a largura
- Em 375px os três empilham
- A faixa lilás aparece entre os cards de Serviços e a seção Sobre, sem colidir com o `-top-12` dos cards de [Services.jsx:33](../../../components/Services.jsx#L33)
- Clicar em qualquer um dos dois links leva para `/analise-de-coloracao-pessoal-online`

- [ ] **Step 6: Commit**

```bash
git add components/Coloracao/FaixaColoracao.jsx components/Hero.jsx app/page.jsx
git commit -m "feat: links da home para a página de coloração pessoal"
```

---

## Verificação final

Depois da Task 6, rode a checagem completa da spec:

- [ ] `npm run build` termina sem erro nem aviso novo
- [ ] `/analise-de-coloracao-pessoal-online` renderiza as quatro seções em 375px, 768px e 1440px, sem scroll horizontal
- [ ] Com `checkout.url` vazia, os CTAs abrem o WhatsApp com a mensagem correta
- [ ] A âncora "Quero descobrir minha cartela" do Hero rola até o bloco de preço
- [ ] A home continua renderizando todas as seções antigas
- [ ] `/sitemap.xml` lista as duas rotas
- [ ] Ver código-fonte da página: existe um `<script type="application/ld+json">` com `"@type":"Service"` e `"price":"99.99"`
- [ ] `<title>` da página nova é "Análise de Coloração Pessoal Online | Millena Barreto"
- [ ] Só uma requisição ao `googletagmanager.com` por página

## Pendência conhecida

`public/consts/checkout.ts` vai para produção com `url: ""`. Enquanto isso, todo CTA de compra cai no WhatsApp. Assim que a URL do checkout existir, basta preencher essa linha — nenhum outro arquivo muda.
