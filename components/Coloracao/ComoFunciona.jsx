const passos = [
  {
    titulo: "Você envia sua foto",
    descricao: "Seguindo as orientações que eu te passo.",
  },
  {
    titulo: "Eu faço sua análise",
    descricao:
      "Uso um material digital que simula os tecidos da análise presencial para identificar as cores que mais harmonizam com você e definir a sua cartela.",
  },
  {
    titulo: "Apresentação ao vivo no Meet",
    descricao:
      "Explico seu resultado, suas melhores cores e dou orientações sobre maquiagem, acessórios, metais e cabelo.",
  },
  {
    titulo: "Você recebe seu dossiê",
    descricao:
      "Um dossiê digital personalizado para consultar sempre que precisar.",
  },
];

const ComoFunciona = () => {
  return (
    <section
      className="py-16 xl:py-24"
      aria-labelledby="como-funciona-heading"
    >
      <div className="container mx-auto">
        <h2
          id="como-funciona-heading"
          className="h2 text-center mb-4"
        >
          Como funciona a{" "}
          <span className="text-accent">análise online</span>
        </h2>
        <p className="text-center max-w-[640px] mx-auto mb-12">
          São quatro etapas simples, do envio da foto até o seu dossiê pronto.
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {passos.map((passo, index) => (
            <li
              key={passo.titulo}
              className="bg-white shadow-custom rounded-lg p-6"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white font-primary text-2xl mb-4">
                {index + 1}
              </span>
              <h3 className="h3 mb-2">{passo.titulo}</h3>
              <p className="text-[15px]">{passo.descricao}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default ComoFunciona;
