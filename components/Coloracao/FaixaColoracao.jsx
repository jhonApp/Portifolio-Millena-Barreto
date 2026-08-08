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
