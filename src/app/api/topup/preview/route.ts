import { z } from "zod";
import { db } from "@/db/client";
import { clientIp, fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { previewTopUp } from "@/server/topups";

const schema = z.object({ coinId: z.string().min(1).max(200), amount: z.string().trim().regex(/^\d{1,9}(\.\d{1,18})?$/) });

/** What a top up would give, at today's price. No deposit address, nothing moves. */
export async function POST(req: Request) {
  if (!(await allow(db(), `topup-preview:${await clientIp()}`, 30, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "Enter an amount.");
  const r = await previewTopUp(body.coinId, body.amount);
  if (typeof r === "string") return fail(409, r);
  return Response.json({ ok: true, preview: r });
}
