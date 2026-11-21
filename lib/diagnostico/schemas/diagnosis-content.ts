import { z } from "zod";
import { DELIVERY_PREFERENCES, STYLES } from "../constants";

// The shape saved in results.content and read by the result screen (RF-08).

const styleSchema = z.enum(STYLES);
const percent = z.number().int().min(0).max(100);

const styleEntry = z.object({ style: styleSchema, label: z.string().min(1), percent });

export const diagnosisContentSchema = z
  .object({
    contentVersionId: z.string().min(1),
    customer: z.object({
      firstName: z.string().min(1),
      deliveryPreference: z.enum(DELIVERY_PREFERENCES),
    }),
    predominant: styleEntry,
    secondary: styleEntry,
    percentages: z.record(styleSchema, percent),
    blocks: z.tuple([
      z.object({ id: z.literal("result"), title: z.string().min(1), paragraphs: z.array(z.string().min(1)).length(3) }),
      z.object({
        id: z.literal("pieces"),
        title: z.string().min(1),
        intro: z.string().min(1),
        items: z.array(z.string().min(1)).length(4),
      }),
      z.object({
        id: z.literal("accessories"),
        title: z.string().min(1),
        intro: z.string().min(1),
        items: z.array(z.string().min(1)).length(3),
      }),
      z.object({ id: z.literal("guidance"), title: z.string().min(1), paragraphs: z.array(z.string().min(1)).length(1) }),
    ]),
  })
  .refine(
    (value) => Object.values(value.percentages).reduce((sum, item) => sum + item, 0) === 100,
    { message: "percentages must sum to 100", path: ["percentages"] },
  );

export type DiagnosisContent = z.infer<typeof diagnosisContentSchema>;
