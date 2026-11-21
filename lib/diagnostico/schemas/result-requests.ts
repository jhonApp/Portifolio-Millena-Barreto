import { z } from "zod";

// Bodies of the public result routes (RF-08).

export const RESULT_MESSAGES = {
  token: "Link inválido.",
  email: "Informe um e-mail válido.",
} as const;

// 32 random bytes in base64url are 43 characters.
export const tokenBodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, RESULT_MESSAGES.token),
});

export const emailBodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254, RESULT_MESSAGES.email).email(RESULT_MESSAGES.email),
});
