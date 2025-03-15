"use client";
import Image from "next/image";
import { Link as ScrollLink } from "react-scroll";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";

// components
import RotatingShape from "./RotatingShape";
import Header from "./Header";

const Hero = () => {
  return (
    <section className="h-[800px] relative bg-accent/10 xl:bg-white" id="home">
      {/* header */}
      <Header />
      <div className="container mx-auto h-full">
        <div className="relative z-20 h-full w-full xl:max-w-[768px] flex flex-col items-center xl:items-start justify-center text-center xl:text-left pt-10">
          <h1 className="h1 mb-2 max-w-[120px] xl:max-w-none">
            <span className="text-accent">Sou consultora de Imagem</span> e Estilo
          </h1>
          <p className="lead max-w-[476px] mb-7">
            O meu trabalho com a consultoria de imagem é voltado para desenvolver 
            estratégias assertivas de imagem para mulheres e empresas que desejam o sucesso!
          </p>
          <ButtonWhatsApp />
        </div>
        {/* image */}
        <div className="hidden xl:flex w-[55vw] h-[800px] absolute top-0 right-0 bg-violet-300">
          <div className="absolute w-[658px] h-[742px] bottom-0 z-40 left-[0.5vw]">
            <Image
              src="/assets/hero/mihOficial.png"
              fill
              quality="100"
              priority
              className="object-contain"
              alt=""
            />
          </div>
          {/* arrow shape */}
          <div
            className="hidden xl:flex absolute top-48 left-[4vw]"
            data-scroll
            data-scroll-speed="0.05"
          >
            <Image
              src="/assets/hero/arrow.svg"
              width={160}
              height={160}
              alt=""
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
