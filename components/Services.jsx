import Image from "next/image";

const services = [
  {
    icon: "assets/services/icon-1.svg",
    title: "Estilo e Confiança",
    description: "Transforme sua maneira de se vestir com confiança. Descubra como otimizar seu guarda-roupa e criar looks únicos a partir das peças que você já possui.",
  },
  {
    icon: "assets/services/icon-3.svg",
    title: "Compras Assertivas",
    description: "Torne suas compras mais inteligentes e assertivas. Aprenda como escolher as peças certas, economizando e evitando desperdício de dinheiro.",
  },
  {
    icon: "assets/services/icon-2.svg",
    title: "Autenticidade",
    description: "Projete uma imagem única e autêntica, alinhada à sua personalidade. Seja moderno, sofisticado ou simplesmente verdadeiro com seu estilo.",
  },
  {
    icon: "assets/services/icon-4.svg",
    title: "Suporte Personalizado",
    description: "Acabe com a frustração de não saber o que vestir. Receba suporte completo para renovar seu guarda-roupa e encontrar seu estilo ideal.",
  },
];

const Services = () => {
  return (
    <section className="relative z-40" id="trabalhos">
      <div className="container mx-auto">
        <ul className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[20px] -top-12 place-items-center lg:place-items-stretch">
          {services.map((service, index) => {
            return (
              <li
                key={index}
                className="bg-white shadow-custom p-6 max-w-[350px] md:max-w-none rounded-lg"
              >
                <Image
                  src={service.icon}
                  width={48}
                  height={48}
                  alt=""
                  className="mb-4"
                />
                <h3 className="text-[20px] text-primary font-semibold mb-3">
                  {service.title}
                </h3>
                <p className="text-[15px]">{service.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default Services;
