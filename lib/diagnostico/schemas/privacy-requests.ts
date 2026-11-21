import { z } from "zod";
import { RESULT_MESSAGES } from "./result-requests";

// Bodies of the public privacy routes (RF-09). The e-mail and token rules are the ones of RF-08.

export const PRIVACY_MESSAGES = {
  email: RESULT_MESSAGES.email,
  token: RESULT_MESSAGES.token,
} as const;

export const deletionRequestBodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254, PRIVACY_MESSAGES.email).email(PRIVACY_MESSAGES.email),
});

// 32 random bytes in base64url are 43 characters.
export const deletionConfirmBodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, PRIVACY_MESSAGES.token),
});
