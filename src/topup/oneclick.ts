/**
 * NEAR Intents 1Click API: quotes with a deposit address, and swap status.
 * The partner key (ONECLICK_JWT) is optional; without it 1Click adds a
 * 0.25% fee. Every answer is checked with Zod.
 */
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { liveTokens } from "./assets";
import { oneClickUrl } from "./oneclick-url";

const SLIPPAGE_BPS = 100;
const DEADLINE_MS = 60 * 60 * 1000;

const quoteSchema = z.object({
  correlationId: z.string().optional(),
  signature: z.string().optional(),
  quote: z
    .object({
      depositAddress: z.string().optional(),
      depositMemo: z.string().optional(),
      amountIn: z.string(),
      amountInFormatted: z.string(),
      amountInUsd: z.string().optional(),
      amountOut: z.string(),
      amountOutFormatted: z.string(),
      minAmountOut: z.string(),
      deadline: z.string().optional(),
      timeEstimate: z.number(),
    })
    .loose(),
}).loose();
export type Quote = z.infer<typeof quoteSchema>;

export const STATUSES = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "INCOMPLETE_DEPOSIT", "REFUNDED", "FAILED"] as const;
const statusSchema = z.object({
  status: z.enum(STATUSES),
  updatedAt: z.string().optional(),
  swapDetails: z
    .object({
      amountOut: z.string().optional(),
      amountOutFormatted: z.string().optional(),
      nearTxHashes: z.array(z.string()).optional(),
      originChainTxHashes: z.array(z.object({ hash: z.string() }).loose()).optional(),
      refundReason: z.string().optional(),
    })
    .loose()
    .optional(),
}).loose();
export type SwapStatus = z.infer<typeof statusSchema>;

function headers(): Record<string, string> {
  const jwt = serverEnv().ONECLICK_JWT;
  return { "content-type": "application/json", ...(jwt && jwt !== "proxy-injected" ? { "X-API-Key": jwt } : {}) };
}

/**
 * Ask 1Click to swap `amount` (base units) of `originAsset` into NEAR for
 * the NEAR Intents balance of `recipient`. `dry: true`
 * just prices it.
 */
export async function quote(args: { originAsset: string; amount: bigint; recipient: string; refundTo?: string; dry: boolean; fetcher?: typeof fetch }): Promise<Quote> {
  const { destination } = await liveTokens(args.fetcher);
  const res = await (args.fetcher ?? fetch)(`${oneClickUrl()}/v0/quote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      dry: args.dry,
      swapType: "EXACT_INPUT",
      slippageTolerance: SLIPPAGE_BPS,
      originAsset: args.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: destination.assetId,
      amount: args.amount.toString(),
      // Delivered to the recipient's NEAR Intents balance: no token
      // registration or account needed first. If the swap fails, 1Click
      // sends the money straight back to the player's own address on the
      // chain they paid from.
      refundTo: args.refundTo ?? args.recipient,
      refundType: args.refundTo ? "ORIGIN_CHAIN" : "INTENTS",
      recipient: args.recipient,
      recipientType: "INTENTS",
      deadline: new Date(Date.now() + DEADLINE_MS).toISOString(),
      ...(serverEnv().ONECLICK_REFERRAL ? { referral: serverEnv().ONECLICK_REFERRAL } : {}),
      quoteWaitingTimeMs: 3000,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = z.object({ message: z.string() }).safeParse(body);
    throw new Error(msg.success ? msg.data.message : `1Click: HTTP ${res.status}`);
  }
  return quoteSchema.parse(body);
}

export async function swapStatus(depositAddress: string, fetcher: typeof fetch = fetch): Promise<SwapStatus> {
  const res = await fetcher(`${oneClickUrl()}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`1Click: HTTP ${res.status}`);
  return statusSchema.parse(await res.json());
}
