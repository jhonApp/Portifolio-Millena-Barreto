"use client";
import Image from "next/image";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";
import RotatingShape from "./RotatingShape";
import Header from "./Header";

const Hero = () => {
  return (
    <section className="h-auto xl:h-[800px] relative bg-accent/10 xl:bg-white" id="home">
      {/* header */}
      <Header />
      <div className="container mx-auto h-full">
        <div className="relative z-20 h-full w-full xl:max-w-[768px] flex flex-col items-center xl:items-start justify-center text-center xl:text-left pt-10">
          <h1 className="h1 mb-2 mt-[100px] xl:mt-[-22px] sm:max-w-full xl:max-w-none">{/* quando for tela menor tirar o max-w-[120px] e colocar o marginTop-100px*/}
            <span className="text-accent">Sou consultora de Imagem</span> e Estilo
          </h1>
          <p className="lead max-w-[476px] mb-7">
            O meu trabalho com a consultoria de imagem é voltado para desenvolver 
            estratégias assertivas de imagem para mulheres e empresas que desejam o sucesso!
          </p>
          <ButtonWhatsApp />

          {/* Imagem no mobile (abaixo do botão) */}
          <div className="w-full flex justify-center xl:hidden">
            <Image
              src="/assets/hero/mihOficial.png"
              width={500}
              height={400}
              quality="100"
              priority
              className="object-contain"
              alt="Consultora de Imagem"
            />
          </div>
        </div>

        {/* Elementos gráficos e imagem grande em telas maiores */}
        <div className="hidden xl:flex w-[55vw] h-[800px] absolute top-0 right-0 bg-violet-300">
          <div className="absolute w-[658px] h-[742px] bottom-0 z-40 left-[0.5vw]">
            <Image
              src="/assets/hero/mihOficial.png"
              fill
              quality="100"
              priority
              className="object-contain"
              alt="Consultora de Imagem"
            />
          </div>
          {/* arrow shape */}
          <div
            className="absolute top-48 left-[4vw]"
            data-scroll
            data-scroll-speed="0.05"
          >
            <Image
              src="/assets/hero/arrow.svg"
              width={160}
              height={160}
              alt="Seta indicando destaque"
            />
          </div>
          {/* shape 1 */}
          <div
            className="absolute top-[600px] left-[6vw]"
            data-scroll
            data-scroll-speed="0.2"
          >
            <RotatingShape
              content={
                <Image
                  src="assets/hero/shape-1.svg"
                  width={38}
                  height={38}
                  alt=""
                />
              }
              direction="left"
              duration={6}
            />
          </div>
          {/* shape 2 */}
          <div
            className="absolute top-[240px] xl:left-[33vw]"
            data-scroll
            data-scroll-speed="0.1"
          >
            <RotatingShape
              content={
                <Image
                  src="assets/hero/shape-2.svg"
                  width={34}
                  height={34}
                  alt=""
                />
              }
              direction="right"
              duration={5}
            />
          </div>
          {/* shape 3 */}
          <div
            className="absolute top-[480px] xl:left-[40vw]"
            data-scroll
            data-scroll-speed="0.08"
          >
            <RotatingShape
              content={
                <Image
                  src="assets/hero/shape-3.svg"
                  width={36}
                  height={36}
                  alt=""
                />
              }
              direction="left"
              duration={7}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
