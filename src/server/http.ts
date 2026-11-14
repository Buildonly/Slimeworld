import { headers } from "next/headers";
import { z } from "zod";

/** A short, friendly error the player may see. Never includes internals. */
export function fail(status: number, message: string): Response {
  return Response.json({ ok: false, error: message }, { status });
}

/** Best-effort client address for rate limiting. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Parse a JSON body with a Zod schema. Returns null on any problem. */
export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | null> {
  try {
    const parsed = schema.safeParse(await req.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
