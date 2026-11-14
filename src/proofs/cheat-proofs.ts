/**
 * Real attempts to cheat the town contract on chain, and the rule that
 * refused each one. Written by `pnpm proofs` and shipped with the game, so
 * every deploy shows the same evidence. Validated like any other input.
 */
import { z } from "zod";
import raw from "./cheat-proofs.json";

const proofSchema = z.object({
  attempt: z.string(),
  title: z.string(),
  story: z.string(),
  error: z.string(),
  txHash: z.string(),
  network: z.string(),
  at: z.string(),
});
export type CheatProof = z.infer<typeof proofSchema>;

export const PROOFS_FILE = "src/proofs/cheat-proofs.json";

export function cheatProofs(): CheatProof[] {
  return z.array(proofSchema).catch([]).parse(raw);
}
