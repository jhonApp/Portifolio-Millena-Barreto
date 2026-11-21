-- RF-03: first questionnaire version (version 1), published.
-- Source: docs/RF-03-question-bank-and-scoring-engine/questionnaire-source.md
-- 15 questions x 4 alternatives; each of the six styles appears in exactly 10 questions; all weights are 1.
-- Later edits go through the admin editor (RF-12), which creates new versions; this migration never changes version 1.

do $seed$
declare
  v_id uuid;
  q jsonb;
  q_id uuid;
  a jsonb;
  v_questions jsonb := $json$[
 {
  "position": 1,
  "text": "Como você gostaria que as pessoas percebessem sua imagem?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Natural, descontraída e acessível."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Discreta, organizada e confiável."
   },
   {
    "position": 3,
    "style": "elegante",
    "text": "Sofisticada, refinada e bem-arrumada."
   },
   {
    "position": 4,
    "style": "criativo",
    "text": "Original, criativa e cheia de personalidade."
   }
  ]
 },
 {
  "position": 2,
  "text": "Qual conjunto de roupas mais chama sua atenção?",
  "alternatives": [
   {
    "position": 1,
    "style": "tradicional",
    "text": "Alfaiataria, camisas e peças clássicas."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Looks monocromáticos, tecidos nobres e cortes impecáveis."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Vestidos fluidos, rendas e estampas delicadas."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Peças estruturadas, cores fortes e contrastes marcantes."
   }
  ]
 },
 {
  "position": 3,
  "text": "Qual sapato você escolheria para usar com frequência?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Tênis confortável e moderno."
   },
   {
    "position": 2,
    "style": "romantico",
    "text": "Sapatilha delicada ou sandália feminina."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Um sapato diferente, colorido ou fora do padrão."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Bota ou salto de design marcante e ousado."
   }
  ]
 },
 {
  "position": 4,
  "text": "Qual característica você mais valoriza nas roupas?",
  "alternatives": [
   {
    "position": 1,
    "style": "tradicional",
    "text": "Discrição e versatilidade."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Qualidade e acabamento impecável."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Originalidade e peças que ninguém mais tem."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Impacto e presença ao entrar em um lugar."
   }
  ]
 },
 {
  "position": 5,
  "text": "Qual acessório combina mais com você?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Bolsa transversal e acessórios funcionais."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Bolsa estruturada e joias sofisticadas."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Pérolas, laços e acessórios delicados."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Maxi acessórios, joias grandes e peças statement."
   }
  ]
 },
 {
  "position": 6,
  "text": "Qual destas opções representa melhor sua relação com a moda?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Gosto de roupas simples e descomplicadas."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Prefiro peças atemporais que nunca saem de moda."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Amo detalhes delicados e peças românticas."
   },
   {
    "position": 4,
    "style": "criativo",
    "text": "Gosto de misturar, inventar e me expressar sem regras."
   }
  ]
 },
 {
  "position": 7,
  "text": "Qual look você escolheria para um jantar especial?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Calça jeans, blusa bonita e tênis estiloso."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Calça de alfaiataria e camisa clássica."
   },
   {
    "position": 3,
    "style": "elegante",
    "text": "Vestido sofisticado e acessórios refinados."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Vestido ou conjunto marcante, com cor forte e corte ousado."
   }
  ]
 },
 {
  "position": 8,
  "text": "Qual destas propostas mais combina com sua personalidade?",
  "alternatives": [
   {
    "position": 1,
    "style": "tradicional",
    "text": "Reservada, organizada e tradicional."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Exigente, refinada e segura."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Sensível, sonhadora e delicada."
   },
   {
    "position": 4,
    "style": "criativo",
    "text": "Criativa, curiosa e fora do padrão."
   }
  ]
 },
 {
  "position": 9,
  "text": "Qual tipo de roupa você gostaria de experimentar mais?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Sobreposições casuais e peças confortáveis."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Peças de caimento impecável e visual sofisticado."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Peças autorais, mix de estampas e modelagens diferentes."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Peças de volumes, cores e recortes marcantes."
   }
  ]
 },
 {
  "position": 10,
  "text": "Qual destas características você gostaria de transmitir ao se vestir?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Leveza e liberdade."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Seriedade e credibilidade."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Doçura e delicadeza."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Força, autoridade e impacto."
   }
  ]
 },
 {
  "position": 11,
  "text": "Qual combinação de cores mais agrada você?",
  "alternatives": [
   {
    "position": 1,
    "style": "elegante",
    "text": "Preto, off-white, cinza e tons sofisticados."
   },
   {
    "position": 2,
    "style": "romantico",
    "text": "Rosa, lavanda, azul-claro e tons suaves."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Cores vibrantes e combinações inesperadas."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Preto com vermelho, cores intensas e contrastes fortes."
   }
  ]
 },
 {
  "position": 12,
  "text": "Como você se sente usando roupas mais justas e que valorizam suas curvas?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Prefiro roupas soltinhas e confortáveis."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Gosto de modelagens discretas e equilibradas."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Depende do dia: gosto de variar volumes e proporções."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Gosto de silhuetas marcadas que chamem atenção."
   }
  ]
 },
 {
  "position": 13,
  "text": "Qual destas propostas de look mais representa seu gosto?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Calça ampla, camiseta e tênis."
   },
   {
    "position": 2,
    "style": "tradicional",
    "text": "Calça reta, camisa e blazer clássico."
   },
   {
    "position": 3,
    "style": "elegante",
    "text": "Vestido de corte elegante e salto refinado."
   },
   {
    "position": 4,
    "style": "romantico",
    "text": "Saia fluida, blusa delicada e sandália."
   }
  ]
 },
 {
  "position": 14,
  "text": "Quando você compra uma roupa diferente, o que mais chama sua atenção?",
  "alternatives": [
   {
    "position": 1,
    "style": "tradicional",
    "text": "Ser clássica e durar por muitos anos."
   },
   {
    "position": 2,
    "style": "romantico",
    "text": "Ter detalhes delicados e femininos."
   },
   {
    "position": 3,
    "style": "criativo",
    "text": "Ser diferente de tudo que já tenho."
   },
   {
    "position": 4,
    "style": "dramatico",
    "text": "Ter impacto e chamar atenção."
   }
  ]
 },
 {
  "position": 15,
  "text": "Se pudesse definir sua imagem ideal em uma palavra, qual seria?",
  "alternatives": [
   {
    "position": 1,
    "style": "esportivo_natural",
    "text": "Descomplicada."
   },
   {
    "position": 2,
    "style": "elegante",
    "text": "Sofisticada."
   },
   {
    "position": 3,
    "style": "romantico",
    "text": "Romântica."
   },
   {
    "position": 4,
    "style": "criativo",
    "text": "Criativa."
   }
  ]
 }
]$json$::jsonb;
begin
  if exists (select 1 from public.questionnaire_versions where version = 1) then
    return;
  end if;

  insert into public.questionnaire_versions (version, status, published_at)
    values (1, 'published', now())
    returning id into v_id;

  for q in select * from jsonb_array_elements(v_questions) loop
    insert into public.questions (version_id, position, text)
      values (v_id, (q->>'position')::smallint, q->>'text')
      returning id into q_id;

    for a in select * from jsonb_array_elements(q->'alternatives') loop
      insert into public.alternatives (question_id, position, text, style, weight)
        values (q_id, (a->>'position')::smallint, a->>'text', a->>'style', 1);
    end loop;
  end loop;
end $seed$;
