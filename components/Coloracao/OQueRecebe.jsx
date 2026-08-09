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
