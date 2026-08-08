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
