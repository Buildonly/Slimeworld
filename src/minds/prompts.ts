/**
 * The mind prompts live in prompts/*.md (the code block in each file).
 * Values are filled in here. Player text is wrapped in <player> tags and
 * stripped of tags, so it stays data, never instructions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map<string, string>();

export function loadPrompt(name: "slime" | "shopkeeper" | "talk"): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const md = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
  const match = /```\n([\s\S]*?)\n```/.exec(md);
  if (!match?.[1]) throw new Error(`No prompt block in prompts/${name}.md`);
  cache.set(name, match[1]);
  return match[1];
}

/** Fill {placeholders}. Unknown placeholders are an error so prompts never ship half-filled. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Prompt value missing: ${key}`);
    return String(v);
  });
}

/** Make player text safe to place inside <player> tags. */
export function playerText(text: string): string {
  return `<player>${text.replace(/[<>]/g, "").slice(0, 300)}</player>`;
}
