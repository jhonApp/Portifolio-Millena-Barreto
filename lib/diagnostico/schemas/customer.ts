import { z } from "zod";
import { DELIVERY_PREFERENCES } from "../constants";
import { normalizeWhatsapp } from "../phone";

// Shared by the registration form (browser) and the attempts route (server).
// Keep this file free of server-only code.

export const CUSTOMER_MESSAGES = {
  fullName: "Informe seu nome completo",
  email: "Informe um e-mail válido",
  whatsapp: "Informe o WhatsApp com DDD",
  deliveryPreference: "Escolha como quer receber",
  consent: "Precisamos do seu consentimento para continuar",
  idempotencyKey: "Chave de envio inválida",
} as const;

export const customerFormSchema = z.object({
  fullName: z
    .string({ error: CUSTOMER_MESSAGES.fullName })
    .trim()
    .min(3, CUSTOMER_MESSAGES.fullName)
    .max(120, CUSTOMER_MESSAGES.fullName)
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, CUSTOMER_MESSAGES.fullName),
  email: z
    .string({ error: CUSTOMER_MESSAGES.email })
    .trim()
    .toLowerCase()
    .max(254, CUSTOMER_MESSAGES.email)
    .email(CUSTOMER_MESSAGES.email),
  whatsapp: z
    .string({ error: CUSTOMER_MESSAGES.whatsapp })
    .transform((value, ctx) => {
      const normalized = normalizeWhatsapp(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: CUSTOMER_MESSAGES.whatsapp });
        return z.NEVER;
      }
      return normalized;
    }),
  deliveryPreference: z.enum(DELIVERY_PREFERENCES, { error: CUSTOMER_MESSAGES.deliveryPreference }),
  consent: z.literal(true, { error: CUSTOMER_MESSAGES.consent }),
  idempotencyKey: z.string({ error: CUSTOMER_MESSAGES.idempotencyKey }).uuid(CUSTOMER_MESSAGES.idempotencyKey),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormData = z.output<typeof customerFormSchema>;
