import Image from "next/image";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";
import ButtonInstagram from "./ButtonBusiness/ButtonInstagram";

const Palestra = () => {
  return (
    <section className="relative pt-12 xl:pb-24" id="palestras">
      <div className="container mx-auto h-full">
        <div className="h-full flex items-center justify-center">
          {/* Imagem */}
          <div className="hidden xl:flex flex-1 pl-10">
            <div className="relative w-full max-w-[380px]">
              {/* Fundo decorativo */}
              <div className="w-[160px] h-[160px] bg-[#f8e5f5] absolute -left-5 -top-5 -z-10"></div>
              {/* Imagem da palestra */}
              <div className="flex items-end justify-center">
                <Image
                  src="/assets/palestra/img-2.JPEG"
                  width={350}
                  height={478}
                  quality={100}
                  unoptimized={true}
                  priority
                  alt="Palestra de consultoria de imagem corporativa com foco em estilo profissional"
                  className="object-cover rounded-tl-[8px] rounded-tr-[120px] min-h-[480px]"
                />
              </div>
            </div>
          </div>

          {/* Conteúdo da palestra */}
          <div className="text-center lg:text-left max-w-lg">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Palestras de{" "}
              <span className="text-accent">
                Imagem Corporativa e Estilo Profissional
              </span>
            </h2>
            <p className="text-gray-600 text-lg mb-6">
              Leve para sua empresa uma palestra transformadora sobre{" "}
              <strong>consultoria de imagem corporativa</strong>,{" "}
              <strong>análise de estilo profissional</strong> e{" "}
              <strong>expressão pessoal no ambiente de trabalho</strong>.
              Fortaleça a presença e a confiança da sua equipe com conteúdos
              práticos e inspiradores.
            </p>

            {/* Benefícios corporativos */}
            <div className="space-y-3 text-gray-700 text-lg">
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🎯</span>{" "}
                <strong>Dress code corporativo</strong> alinhado à identidade da
                marca e à cultura da empresa.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💼</span> Aumento da{" "}
                <strong>credibilidade profissional</strong> e fortalecimento da
                imagem institucional.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🌟</span>
                Melhoria na{" "}
                <strong>autoestima, engajamento e produtividade</strong> das
                equipes.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🎤</span>{" "}
                <strong>Palestras dinâmicas e personalizadas</strong> para
                empresas, eventos e treinamentos internos.
              </div>
            </div>

            {/* Chamadas para ação */}
            <div className="mt-6 pb-10">
              <p className="text-gray-700 mb-4">
                Solicite uma palestra personalizada e transforme a imagem da sua
                equipe.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <ButtonInstagram />
                <ButtonWhatsApp />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Palestra;
