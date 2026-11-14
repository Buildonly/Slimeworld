/**
 * Preflight attestation for a model, before trusting its signatures:
 * 1. ask NEAR AI for the model's attestation report with a fresh nonce,
 * 2. verify the Intel TDX quote (dcap-qvl, Intel's collateral),
 * 3. check the quote's report data binds the signing address and our nonce,
 * 4. check the enclave is not in debug mode.
 * The result is cached for ATTESTATION_TTL_MS.
 */
import { getCollateralAndVerify } from "@phala/dcap-qvl";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ATTESTATION_TTL_MS, nearAiUrl } from "./settings";

const reportSchema = z.object({
  model_attestations: z.array(
    z.object({
      signing_address: z.string(),
      signing_algo: z.string(),
      intel_quote: z.string(),
      request_nonce: z.string().optional(),
    }).loose(),
  ),
}).loose();

export type Attestation = {
  model: string;
  signingAddress: string;
  tcbStatus: string;
  nonce: string;
  verifiedAt: number;
};

const cache = new Map<string, Attestation>();

function bytesHex(b: Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

/** Verify one candidate report. Returns the attestation or a reason it failed. */
async function verifyCandidate(model: string, nonce: string, c: z.infer<typeof reportSchema>["model_attestations"][number]): Promise<Attestation | string> {
  if (c.signing_algo !== "ecdsa") return "Wrong signing algorithm";
  const result = (await getCollateralAndVerify(Buffer.from(c.intel_quote, "hex"))) as {
    status: string;
    report: { type: string; data: { reportData: Uint8Array; tdAttributes: Uint8Array } };
  };
  if (!["UpToDate", "SWHardeningNeeded", "ConfigurationAndSWHardeningNeeded"].includes(result.status)) return `TCB status ${result.status}`;
  const td = result.report.data;
  if ((td.tdAttributes[0] ?? 1) & 1) return "Enclave is in debug mode";
  const reportData = bytesHex(td.reportData);
  const address = c.signing_address.replace(/^0x/, "").toLowerCase();
  if (reportData.slice(0, 64) !== address.padEnd(64, "0")) return "Quote does not bind the signing address";
  if (reportData.slice(64) !== nonce) return "Quote does not carry our nonce";
  return { model, signingAddress: c.signing_address, tcbStatus: result.status, nonce, verifiedAt: Date.now() };
}

export async function attestModel(model: string, fetcher: typeof fetch = fetch): Promise<Attestation> {
  const hit = cache.get(model);
  if (hit && Date.now() - hit.verifiedAt < ATTESTATION_TTL_MS) return hit;
  const nonce = randomBytes(32).toString("hex");
  const url = `${nearAiUrl()}/attestation/report?model=${encodeURIComponent(model)}&provider=near&signing_algo=ecdsa&nonce=${nonce}`;
  const res = await fetcher(url, { headers: { "x-no-aliasing": "true" } });
  if (!res.ok) throw new Error(`Attestation report: HTTP ${res.status}`);
  const report = reportSchema.parse(await res.json());
  const reasons: string[] = [];
  const good: Attestation[] = [];
  for (const c of report.model_attestations) {
    const r = await verifyCandidate(model, nonce, c);
    if (typeof r === "string") reasons.push(r);
    else good.push(r);
  }
  const addresses = new Set(good.map((g) => g.signingAddress.toLowerCase()));
  if (addresses.size !== 1 || !good[0]) throw new Error(`No single verified enclave for ${model}: ${reasons.join("; ") || "none"}`);
  cache.set(model, good[0]);
  return good[0];
}
