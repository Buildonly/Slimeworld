/**
 * Check a NEAR AI Cloud response signature (EIP-191 personal_sign, ecdsa):
 * the signed text must be "{model}:{sha256(request)}:{sha256(response)}"
 * over the exact bytes we sent and received, and the recovered signer must
 * be the address the attested model enclave reported.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function expectedSignedText(model: string, request: Uint8Array, response: Uint8Array): string {
  return `${model}:${sha256Hex(request)}:${sha256Hex(response)}`;
}

/** Recover the Ethereum address that personal_signed `message`. */
export function recoverPersonalSign(message: string, signatureHex: string): string {
  const msg = utf8ToBytes(message);
  const prefixed = new Uint8Array([...utf8ToBytes(`\x19Ethereum Signed Message:\n${msg.length}`), ...msg]);
  const hash = keccak_256(prefixed);
  const sig = hexToBytes(signatureHex.replace(/^0x/, ""));
  if (sig.length !== 65) throw new Error("Bad signature length");
  const v = sig[64]!;
  const recovery = v >= 27 ? v - 27 : v;
  // noble's recovered format: [recovery byte][r][s]
  const recovered = new Uint8Array([recovery, ...sig.slice(0, 64)]);
  const pub = secp256k1.recoverPublicKey(recovered, hash, { prehash: false });
  const uncompressed = secp256k1.Point.fromBytes(pub).toBytes(false);
  return `0x${bytesToHex(keccak_256(uncompressed.slice(1)).slice(-20))}`;
}

export type SignatureCheck = { ok: boolean; why: string };

export function checkSignature(args: {
  model: string;
  request: Uint8Array;
  response: Uint8Array;
  text: string;
  signature: string;
  signingAddress: string;
  attestedAddress: string;
}): SignatureCheck {
  const expected = expectedSignedText(args.model, args.request, args.response);
  if (args.text !== expected) return { ok: false, why: "Signed text does not match our request and response" };
  let signer: string;
  try {
    signer = recoverPersonalSign(args.text, args.signature);
  } catch {
    return { ok: false, why: "Signature does not parse" };
  }
  if (signer.toLowerCase() !== args.signingAddress.toLowerCase()) return { ok: false, why: "Signer does not match" };
  if (signer.toLowerCase() !== args.attestedAddress.toLowerCase()) return { ok: false, why: "Signer is not the attested enclave" };
  return { ok: true, why: "Signed by the attested enclave" };
}
