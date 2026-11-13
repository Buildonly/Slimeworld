/**
 * Minimal NEAR AI Cloud client that keeps the exact request and response
 * bytes, fetches the response signature and checks it against the attested
 * enclave. The API key is injected by the environment (NEAR_AI_API_KEY);
 * it is never logged.
 */
import { z } from "zod";
import { attestModel, type Attestation } from "./attestation";
import { NEAR_AI_BASE_URL, MIND_TIMEOUT_MS } from "./settings";
import { checkSignature, sha256Hex } from "./signature";

const completionSchema = z.object({
  id: z.string(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }).loose() }).loose()).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).loose().optional(),
}).loose();

const signatureSchema = z.object({
  text: z.string(),
  signature: z.string(),
  signing_address: z.string(),
  signing_algo: z.string(),
  signature_kind: z.string().nullish(),
}).loose();

/** Everything needed to re-check a decision later, stored with it. */
export type MindProof = {
  model: string;
  chatId: string;
  requestHash: string;
  responseHash: string;
  signedText: string;
  signature: string;
  signingAddress: string;
  signatureKind: string | null;
  attestation: { tcbStatus: string; nonce: string; verifiedAt: string } | null;
  tokens: { prompt: number; completion: number } | null;
  check: string;
};

export type SignedAnswer = { content: string; verified: boolean; proof: MindProof };

function headers(apiKey: string | undefined): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-no-aliasing": "true",
    "accept-encoding": "identity",
    // In local dev the network proxy injects the key; elsewhere it comes from the environment.
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

export async function chatSigned(args: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  apiKey?: string;
  fetcher?: typeof fetch;
}): Promise<SignedAnswer> {
  const fetcher = args.fetcher ?? fetch;
  // Attest first: signatures are only matched against a report fetched before the call.
  let attestation: Attestation | null = null;
  try {
    attestation = await attestModel(args.model, fetcher);
  } catch {
    attestation = null;
  }
  const body = JSON.stringify({
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    max_tokens: args.maxTokens,
    response_format: { type: "json_object" },
    chat_template_kwargs: { enable_thinking: false },
  });
  const request = new TextEncoder().encode(body);
  const res = await fetcher(`${NEAR_AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(args.apiKey),
    body: request,
    signal: AbortSignal.timeout(MIND_TIMEOUT_MS),
  });
  const response = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) throw new Error(`NEAR AI: HTTP ${res.status}`);
  const completion = completionSchema.parse(JSON.parse(new TextDecoder().decode(response)));
  const content = completion.choices[0]?.message.content ?? "";

  const proof: MindProof = {
    model: args.model,
    chatId: completion.id,
    requestHash: sha256Hex(request),
    responseHash: sha256Hex(response),
    signedText: "",
    signature: "",
    signingAddress: "",
    signatureKind: null,
    attestation: attestation ? { tcbStatus: attestation.tcbStatus, nonce: attestation.nonce, verifiedAt: new Date(attestation.verifiedAt).toISOString() } : null,
    tokens: completion.usage ? { prompt: completion.usage.prompt_tokens, completion: completion.usage.completion_tokens } : null,
    check: "Not checked",
  };

  // The signature can take a moment to appear; retry briefly on 404.
  for (let attempt = 0; attempt < 4; attempt++) {
    const sres = await fetcher(`${NEAR_AI_BASE_URL}/signature/${encodeURIComponent(completion.id)}?model=${encodeURIComponent(args.model)}&signing_algo=ecdsa`, {
      headers: headers(args.apiKey),
    });
    if (sres.status === 404) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }
    const parsed = signatureSchema.safeParse(await sres.json().catch(() => null));
    if (!sres.ok || !parsed.success) {
      proof.check = "No signature available";
      break;
    }
    const sig = parsed.data;
    Object.assign(proof, { signedText: sig.text, signature: sig.signature, signingAddress: sig.signing_address, signatureKind: sig.signature_kind ?? null });
    if (!attestation) {
      proof.check = "Model attestation could not be verified";
      break;
    }
    const check = checkSignature({
      model: args.model,
      request,
      response,
      text: sig.text,
      signature: sig.signature,
      signingAddress: sig.signing_address,
      attestedAddress: attestation.signingAddress,
    });
    proof.check = check.why;
    return { content, verified: check.ok, proof };
  }
  return { content, verified: false, proof };
}
