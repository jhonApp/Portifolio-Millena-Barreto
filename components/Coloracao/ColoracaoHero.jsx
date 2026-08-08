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
