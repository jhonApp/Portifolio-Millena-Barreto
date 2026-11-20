import { z } from "zod";

// The browser may send an amount, but the server never uses it: PRICE_CENTS always prevails.
// The field is parsed only so a different value can be logged.
export const checkoutBodySchema = z.object({
  amountCents: z.number().optional(),
});
