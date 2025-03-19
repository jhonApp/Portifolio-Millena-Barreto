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
                  alt="Palestra sobre consultoria de estilo para empresas"
                  className="object-cover rounded-tl-[8px] rounded-tr-[120px] min-h-[480px]"
                />
              </div>
            </div>
          </div>

          {/* Conteúdo da palestra */}
          <div className="text-center lg:text-left max-w-lg">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Transforme a imagem da sua equipe com minhas palestras
            </h2>
            <p className="text-gray-600 text-lg mb-6">
              A consultoria de estilo e coloração pessoal ajudam empresas a fortalecer a identidade visual de suas equipes, elevando a confiança e profissionalismo no ambiente de trabalho.
            </p>

            {/* Benefícios corporativos */}
            <div className="space-y-3 text-gray-700 text-lg">
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🎯</span> Dress code alinhado à identidade da empresa
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💼</span> Profissionalismo e credibilidade para equipes
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🌟</span> Melhoria na autoestima e produtividade
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">🎤</span> Conteúdo dinâmico e prático para sua equipe
              </div>
            </div>

            {/* Chamadas para ação */}
            <div className="mt-6 pb-10">
              <p className="text-gray-700 mb-4">
                Entre em contato e leve essa experiência para sua empresa!
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
