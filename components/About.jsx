import Image from "next/image";
import { motion } from "framer-motion";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";
import ButtonInstagram from "./ButtonBusiness/ButtonInstagram";

const About = () => {
  return (
    <section className="relative pt-12 xl:pb-24" id="redes-sociais">
      <div className="container mx-auto h-full">
        <div className="h-full flex items-center justify-center">
          {/* image + shapes */}
          <div className="hidden xl:flex flex-1 pl-10">
            <div className="relative w-full max-w-[380px]">
              {/* shape */}
              <div className="w-[160px] h-[160px] bg-[#e5f8f6] absolute -left-5 -top-5 -z-10"></div>
              {/* image */}
              <div className="flex items-end justify-center">
                <Image
                  src="/assets/about/img.JPEG"
                  width={350}
                  height={478}
                  quality={100}
                  unoptimized={true}
                  priority
                  alt=""
                  className="object-cover rounded-tl-[8px] rounded-tr-[120px] min-h-[480px]"
                />
              </div>
              {/* rotating shape */}
              <div className="absolute top-2/4 -right-[65px] flex items-center justify-center">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 10,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                >
                  <Image
                    src="/assets/about/shape-1.svg"
                    width={160}
                    height={160}
                    alt=""
                  />
                </motion.div>
                <div className="absolute text-center text-white">
                  <div className="text-5xl font-bold leading-none">5+</div>
                  <div className="leading-none text-center">
                    Anos de <br /> Experiência
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Conteúdo de Redes Sociais */}
          <div className="text-center lg:text-left max-w-lg">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              Me Siga nas Redes Sociais
            </h2>
            <p className="text-gray-600 text-lg mb-6">
              No meu Instagram, compartilho diariamente conteúdos sobre{" "}
              <strong>consultoria de imagem</strong>,{" "}
              <strong>colorimetria</strong> e <strong>autoconhecimento</strong>{" "}
              através do estilo. Descubra como a{" "}
              <strong>coloração pessoal</strong> pode transformar a forma como
              você se vê e se apresenta, destacando suas{" "}
              <strong>melhores cores e traços</strong>. Aprenda a criar um{" "}
              <strong>guarda-roupa inteligente</strong>, escolher tons que
              harmonizam com sua pele e refletir a melhor versão de si mesma.
            </p>

            {/* Benefícios com ícones */}
            <div className="space-y-3 text-gray-700 text-lg">
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">✨</span>
                Dicas diárias de <strong>estilo pessoal</strong>,{" "}
                <strong>moda consciente</strong> e tendências para realçar sua
                imagem.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💖</span>
                Promoções exclusivas e{" "}
                <strong>
                  cupons de consultoria de imagem e coloração pessoal
                </strong>{" "}
                para transformar seu visual.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💄</span>
                Aprenda a escolher{" "}
                <strong>maquiagem de acordo com sua coloração pessoal</strong> e
                realce sua <strong>beleza natural</strong> com as cores certas.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">📸</span>
                Inspire-se com o <strong>antes e depois de clientes</strong> que
                descobriram sua <strong>paleta de cores pessoal</strong> e um{" "}
                <strong>estilo autêntico</strong> através da{" "}
                <strong>consultoria de imagem</strong>.
              </div>
            </div>

            {/* Container para os botões */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <ButtonInstagram />
              <ButtonWhatsApp />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
