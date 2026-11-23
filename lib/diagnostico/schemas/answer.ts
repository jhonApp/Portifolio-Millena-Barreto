import { z } from "zod";

// Body of PUT /api/diagnostico/answers. Shared by the route and the tests.
export const ANSWER_MESSAGES = {
  questionId: "Pergunta inválida.",
  alternativeId: "Alternativa inválida para esta pergunta.",
  secondAlternativeId: "Segunda escolha inválida para esta pergunta.",
} as const;

export const answerBodySchema = z.object({
  questionId: z.string({ error: ANSWER_MESSAGES.questionId }).uuid(ANSWER_MESSAGES.questionId),
  alternativeId: z.string({ error: ANSWER_MESSAGES.alternativeId }).uuid(ANSWER_MESSAGES.alternativeId),
  // The optional second choice; null or absent means "no second choice".
  secondAlternativeId: z
    .string({ error: ANSWER_MESSAGES.secondAlternativeId })
    .uuid(ANSWER_MESSAGES.secondAlternativeId)
    .nullish(),
});

export type AnswerBody = z.output<typeof answerBodySchema>;
