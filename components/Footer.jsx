import Logo from "./Logo";

const Footer = () => {
  return (
    <footer className="py-12 bg-primary text-white">
      <div className="container mx-auto">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 text-center xl:text-left">
          {/* Logo */}
          <Logo light={true} />

          {/* Texto otimizado para SEO */}
          <div className="max-w-[600px] text-white/80 text-sm leading-relaxed">
            <p>
              Consultoria de Imagem, Estilo e Coloração Pessoal com foco em
              <strong> análise de imagem corporativa</strong> e{" "}
              <strong>posicionamento profissional</strong>. Auxílio mulheres,
              empreendedoras e empresas a fortalecerem sua marca pessoal e
              identidade visual com autenticidade e propósito.
            </p>
            <p className="mt-2">
              Serviços: <strong>consultoria de imagem feminina</strong>,{" "}
              <strong>análise de coloração pessoal</strong>,{" "}
              <strong>consultoria de estilo corporativo</strong> e{" "}
              <strong>imagem profissional para empresas</strong>.
            </p>
          </div>

          {/* Direitos autorais */}
          <div className="text-white/60 text-sm">
            © 2024 Millena Barreto — Consultoria de Imagem e Estilo. Todos os
            direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
