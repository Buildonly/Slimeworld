import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSignature, expectedSignedText, recoverPersonalSign } from "./signature";

// A real signed exchange with NEAR AI Cloud (Qwen/Qwen3.6-35B-A3B-FP8), byte for byte.
const dir = join(__dirname, "fixtures");
const request = new Uint8Array(readFileSync(join(dir, "qwen-request.json")));
const response = new Uint8Array(readFileSync(join(dir, "qwen-response.json")));
const sig = JSON.parse(readFileSync(join(dir, "qwen-signature.json"), "utf8")) as {
  text: string;
  signature: string;
  signing_address: string;
};
const model = "Qwen/Qwen3.6-35B-A3B-FP8";

describe("NEAR AI response signatures", () => {
  it("rebuilds the signed text from the exact bytes", () => {
    expect(expectedSignedText(model, request, response)).toBe(sig.text);
  });

  it("recovers the enclave's signing address", () => {
    expect(recoverPersonalSign(sig.text, sig.signature).toLowerCase()).toBe(sig.signing_address.toLowerCase());
  });

  it("accepts the real answer from the attested enclave", () => {
    const r = checkSignature({ model, request, response, ...sig, signingAddress: sig.signing_address, attestedAddress: sig.signing_address });
    expect(r).toEqual({ ok: true, why: "Signed by the attested enclave" });
  });

  it("rejects an answer that was changed by even one byte", () => {
    const tampered = new Uint8Array(response);
    tampered[tampered.length - 2] = 32;
    const r = checkSignature({ model, request, response: tampered, ...sig, signingAddress: sig.signing_address, attestedAddress: sig.signing_address });
    expect(r.ok).toBe(false);
  });

  it("rejects a signer that is not the attested one", () => {
    const r = checkSignature({ model, request, response, ...sig, signingAddress: sig.signing_address, attestedAddress: "0x0000000000000000000000000000000000000001" });
    expect(r).toEqual({ ok: false, why: "Signer is not the attested enclave" });
  });
});
