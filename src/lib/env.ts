import { z } from "zod";

/**
 * Server environment, validated once on first use.
 * Optional keys are optional so the game can run locally in "offline" mode
 * (mock minds, no chain writes) before every service is configured.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NEAR_RPC_URL: z.string().url().optional(),
  NEAR_GAME_ACCOUNT: z.string().min(2).optional(),
  NEAR_GAME_PRIVATE_KEY: z.string().startsWith("ed25519:").optional(),
  NEAR_RELAYER_PRIVATE_KEY: z.string().startsWith("ed25519:").optional(),
  NEAR_AI_API_KEY: z.string().min(1).optional(),
  NEAR_AI_MODEL: z.string().min(1).optional(),
  ONECLICK_JWT: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1).optional(),
  PRIVY_APP_SECRET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Read and validate the server environment. Never logs values. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const empty = (v: string | undefined) => (v === "" ? undefined : v);
  const raw = Object.fromEntries(
    Object.keys(serverEnvSchema.shape).map((k) => [k, empty(process.env[k])]),
  );
  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Bad or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
