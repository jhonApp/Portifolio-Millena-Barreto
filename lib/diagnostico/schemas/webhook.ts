import { z } from "zod";

// Tolerant on purpose: AbacatePay may add fields, so only what is read is declared and
// unknown fields are dropped, never rejected.
export const webhookEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  devMode: z.boolean().optional(),
  data: z
    .object({
      transparent: z
        .object({
          id: z.string().min(1),
          amount: z.number().optional(),
          status: z.string().optional(),
          externalId: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
