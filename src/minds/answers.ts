/** Every model answer is checked against these schemas; anything else is dropped. */
import { z } from "zod";

export const slimeAnswerSchema = z.object({
  action: z.enum(["job", "race", "puzzle", "train", "toy", "hat", "save"]),
  target: z.string().max(40).nullable(),
  reason: z.string().min(1).max(120),
  say: z.string().max(80).nullable(),
});
export type SlimeAnswer = z.infer<typeof slimeAnswerSchema>;

export const shopAnswerSchema = z.object({
  margin: z.enum(["low", "normal", "high"]),
  restock: z.array(z.object({ item: z.string().max(20), amount: z.number().int().min(0).max(1000) })).max(10),
  hire: z.number().int().min(0).max(10),
  hoard: z.string().max(20).nullable(),
  reason: z.string().min(1).max(140),
});
export type ShopAnswer = z.infer<typeof shopAnswerSchema>;

/** Models sometimes wrap JSON in prose or code fences; take the first object. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
