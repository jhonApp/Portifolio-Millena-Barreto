import Image from "next/image";
import { motion } from "framer-motion";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";
import ButtonInstagram from "./ButtonBusiness/ButtonInstagram";


const About = () => {
  return (
    <section className="relative pt-12 xl:pb-24" id="redes sociais">
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
              Descubra dicas exclusivas de moda, autoestima, maquiagem e consultoria de imagem! No meu Instagram, você encontra inspirações diárias para destacar seu estilo único e elevar sua confiança.
            </p>

            {/* Benefícios com ícones */}
            <div className="space-y-3 text-gray-700 text-lg">
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">✨</span> Dicas diárias de estilo e tendências
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💖</span> Promoções e cupons exclusivos
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">💄</span> Aprenda a usar maquiagem com auxilio da sua coloração pessoal
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-2xl">📸</span> Veja antes e depois de clientes que passaram pela consultoria e descobriram seu estilo ideal.
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
