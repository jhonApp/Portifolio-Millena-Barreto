# Página: Análise de Coloração Pessoal Online

**Data:** 2026-08-08
**Rota:** `/analise-de-coloracao-pessoal-online`
**Status:** Aprovado pela usuária

## Objetivo

Criar uma landing page de venda para o serviço "Análise de Coloração Pessoal Online" (R$ 247,00 → R$ 99,99), seguindo a identidade visual e os padrões de código que o site já usa.

Hoje o site é uma página única ([app/page.jsx](../../../app/page.jsx)). Esta será a primeira rota secundária.

## Contexto do projeto

- Next.js 14.2.14, App Router, componentes em JSX (não TSX)
- Tailwind — `primary #10151f`, `secondary #475467`, `accent #937dad`
- Fontes: Bebas Neue (`font-primary`, títulos) e Inter (`font-secondary`, corpo)
- Classes utilitárias em [app/globals.css](../../../app/globals.css): `.h1`, `.h2`, `.h3`, `.lead`, `.btn`, `.btn-accent`, sombra `shadow-custom`
- Padrão de agrupamento de componentes por pasta: `components/Work/`, `components/Stats/`, `components/ButtonBusiness/`

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Destino dos CTAs | Link de checkout externo | Compra direta, sem intermediação por conversa |
| URL do checkout | Kiwify — `https://pay.kiwify.com.br/z9aVhTY` | Fornecida pela cliente durante a implementação |
| "Por tempo limitado" | Selo estático | Sem JS, sem manutenção, sem risco de contador zerado matar a conversão |
| Visual | Página clara + bloco de preço escuro | Mantém a identidade do site; contraste só onde converte |
| Rota | `/analise-de-coloracao-pessoal-online` | Slug com a palavra-chave que o site já trabalha no SEO |
| Seções extras | Só "O que você recebe" | Sem galeria, sem depoimentos, sem FAQ |
| Botão do Hero | Rola até o bloco de preço | Não pedir a compra antes de mostrar o preço |
| Organização do código | Componentes em `components/Coloracao/` | Segue o padrão do repo; arquivos pequenos e focados |

## Arquitetura

### Arquivos novos

```
app/analise-de-coloracao-pessoal-online/page.jsx   server component — metadata + JSON-LD
components/Coloracao/ColoracaoHero.jsx
components/Coloracao/ComoFunciona.jsx
components/Coloracao/OQueRecebe.jsx
components/Coloracao/Investimento.jsx              bloco escuro
components/Coloracao/ButtonCheckout.jsx            CTA reutilizável
components/Coloracao/FaixaColoracao.jsx            faixa de destaque usada na home
public/consts/checkout.ts
```

### Arquivos alterados

```
app/sitemap.ts       adiciona a nova rota
app/layout.jsx       recebe os <Script> do GA4; scroll-smooth na tag <html>
app/page.jsx         remove os <Script> do GA4; renderiza <FaixaColoracao /> após <Services />
components/Hero.jsx  botão primário "Quero descobrir minha cartela"
```

### Server vs. client

[app/page.jsx](../../../app/page.jsx) é `"use client"` e por isso não pode exportar `metadata` — todo o SEO do site vem hoje do [layout.jsx](../../../app/layout.jsx).

A página nova é **server component**: exporta `metadata` própria e o JSON-LD, e importa os componentes de seção. Só os componentes que precisam de interatividade levam `"use client"`.

### `ButtonCheckout`

Prop: `label` (string).

Comportamento: renderiza um `<a>` para `checkout.url`, com `target="_blank"` e `rel="noopener noreferrer"`.

A URL vive em um único lugar, então trocar de oferta ou de plataforma de pagamento é uma linha — nenhum componente muda.

`public/consts/checkout.ts`:

```ts
export const checkout = {
  // Link de pagamento do Kiwify. Para trocar de oferta ou de plataforma,
  // altere só esta URL.
  url: "https://pay.kiwify.com.br/z9aVhTY",
};
```

## Conteúdo das seções

### 1. Hero (`ColoracaoHero.jsx`)

- Fundo `bg-accent/10`, mesmo tratamento do [Hero.jsx](../../../components/Hero.jsx) em telas pequenas
- Reusa o `<Header />` existente (logo)
- Eyebrow: pílula lilás com o texto `ONLINE`
- H1 (classe `.h1`): **Análise de Coloração Pessoal**
- Lead: "Descubra as cores que te valorizam de verdade."
- Imagem: `/assets/hero/mihOficial.png`
- CTA: **Quero descobrir minha cartela** → `<a href="#investimento">`

O scroll suave vem de `scroll-smooth` na tag `<html>` do [layout.jsx](../../../app/layout.jsx) (utilitário do Tailwind, equivale a `scroll-behavior: smooth`). Uma âncora HTML pura evita transformar o Hero em client component só por causa de um scroll. O `react-scroll`, já usado no [Nav.jsx](../../../components/Nav.jsx), serve para navegação entre seções de uma mesma página com destaque de item ativo — não é necessário aqui.

### 2. Como funciona (`ComoFunciona.jsx`)

Quatro passos numerados. O texto original tinha três parágrafos, mas o dossiê é uma etapa própria.

1. **Você envia sua foto** — Seguindo as orientações que eu te passo.
2. **Eu faço sua análise** — Uso um material digital que simula os tecidos da análise presencial pra identificar as cores que mais harmonizam com você e definir sua cartela.
3. **Apresentação ao vivo no Meet** — Explico seu resultado, suas melhores cores e dou orientações sobre maquiagem, acessórios, metais e cabelo.
4. **Você recebe seu dossiê** — Dossiê digital personalizado pra consultar sempre que precisar.

### 3. O que você recebe (`OQueRecebe.jsx`)

Seis cards no mesmo padrão visual de [Services.jsx](../../../components/Services.jsx) (`bg-white shadow-custom p-6 rounded-lg`), grid `1 / 2 / 3` colunas. Ícones de `lucide-react` (já instalado), cor `accent`.

| Ícone | Título | Descrição |
|---|---|---|
| `FileText` | Dossiê digital | Material completo e personalizado com sua análise. |
| `Palette` | Cartela de cores | Sua cartela exclusiva com todas as cores que te valorizam. |
| `Shirt` | Dicas de looks | Sugestões práticas para montar looks incríveis no seu dia a dia. |
| `Brush` | Maquiagem correta | Cores ideais de maquiagem que realçam sua beleza natural. |
| `Gem` | Acessórios | Acessórios que harmonizam com sua cartela e destacam seu estilo. |
| `Scissors` | Cores de cabelo | Tons de cabelo que iluminam e trazem mais harmonia para você. |

### 4. Investimento (`Investimento.jsx`)

`id="investimento"` (alvo da âncora do Hero). Card `bg-primary` com texto branco, centralizado.

- Selo: `⏳ Oferta por tempo limitado` (pílula, fundo `accent`)
- `De R$ 247,00` com `line-through` e opacidade reduzida
- **R$ 99,99** em destaque (Bebas, tamanho grande)
- Subtexto: "Pix ou cartão de crédito"
- CTA: **Quero minha análise** → `ButtonCheckout`

## SEO

`metadata` exportada de `app/analise-de-coloracao-pessoal-online/page.jsx`:

- **title:** "Análise de Coloração Pessoal Online | Millena Barreto"
- **description:** "Descubra as cores que te valorizam de verdade. Análise de coloração pessoal 100% online, com apresentação ao vivo e dossiê digital personalizado. De R$ 247 por R$ 99,99."
- **canonical:** `https://millenabarreto.com.br/analise-de-coloracao-pessoal-online`
- **openGraph / twitter:** mesma imagem `https://millenabarreto.com.br/assets/work/coloracao-julia.jpg`, `locale: pt_BR`
- **JSON-LD** `Service` com `provider` apontando para a marca e `offers` (`price: "99.99"`, `priceCurrency: "BRL"`, `availability: InStock`)

`app/sitemap.ts` ganha a rota com `priority: 0.9` e `changeFrequency: "monthly"`.

## Links a partir da home

1. **Hero da home** — botão primário **Quero descobrir minha cartela** (`next/link` para a nova rota), antes dos botões de Instagram e WhatsApp. No mobile os três empilham; o container já usa `flex-col sm:flex-row`.
2. **Faixa de destaque** — logo abaixo de `<Services />` em [app/page.jsx](../../../app/page.jsx). Não é um 5º card em Serviços, porque o grid é `xl:grid-cols-4` e um item ímpar quebraria o alinhamento.

   Fundo `bg-accent/10`, largura de container, conteúdo em linha no desktop e empilhado no mobile:

   > **Análise de Coloração Pessoal Online**
   > De ~~R$ 247,00~~ por **R$ 99,99** · vagas por tempo limitado
   > `[ Quero descobrir minha cartela ]` → `/analise-de-coloracao-pessoal-online`

   Fica em um componente próprio, `components/Coloracao/FaixaColoracao.jsx`, importado pela home.

## Correção incidental: GA4

Os dois `<Script>` do Google Analytics estão em [app/page.jsx:17-32](../../../app/page.jsx#L17-L32), não no layout. Sem mudança, a página nova não seria rastreada e não haveria como medir a origem das vendas.

Os `<Script>` vão para [app/layout.jsx](../../../app/layout.jsx) (dentro do `<body>`, mantendo `strategy="afterInteractive"`) e saem de `app/page.jsx`. Sem efeito visual; o mesmo ID `G-3NYKM6Q9VQ` passa a cobrir as duas rotas.

## Fora de escopo

- Galeria de resultados de clientes, depoimentos e FAQ
- Contador regressivo
- Integração de pagamento (só o link externo)
- Consertar o `links` indefinido em [components/Nav.jsx:8](../../../components/Nav.jsx#L8) — componente quebrado, mas não usado por nenhuma página; não afeta este trabalho

## Verificação

- `npm run build` conclui sem erro
- `npm run lint` sem novos avisos
- `/analise-de-coloracao-pessoal-online` renderiza as quatro seções em 375px, 768px e 1440px
- O CTA "Quero minha análise" abre o checkout do Kiwify em nova aba
- A home continua renderizando e o link novo leva à página
- `/sitemap.xml` lista as duas rotas
