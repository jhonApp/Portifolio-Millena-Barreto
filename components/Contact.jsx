import AnimatedText from "./AnimatedText";
import Image from "next/image";
import ButtonWhatsApp from "./ButtonBusiness/ButtonWhatsApp";

const Contact = () => {

  return (
    <section className="pt-8 xl:pt-12 pb-32" id="contate-me">
      <div className="container mx-auto">
        <div className="flex flex-col items-start xl:flex-row gap-16">
          <div className="flex-1 mx-auto xl:mx-0 flex flex-col">
            <AnimatedText
              text="Eai Estilosa! Vamos fazer sua consultoria de estilo?"
              textStyles="h2 mb-12 text-center xl:text-left"
            />
            <div className="mt-5 flex justify-center xl:justify-start">
              <ButtonWhatsApp />
            </div>
          </div>
          {/* image */}
          <div className="hidden xl:flex relative w-[577px] h-[664px] rounded-lg overflow-hidden">
            <Image
              src="/assets/contact/img.png"
              className="object-cover"
              fill
              quality={100}
              alt=""
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
