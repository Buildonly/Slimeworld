/** Small helpers the setup scripts share: required settings and writing git-ignored env files. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** A setting the script cannot run without. Nothing is assumed. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Env files to update: DOTENV_CONFIG_PATH (comma separated), else .env and .env.local. */
export const ENV_FILES = (process.env.DOTENV_CONFIG_PATH ?? ".env,.env.local").split(",");

export function setEnv(key: string, value: string, files: string[] = ENV_FILES) {
  for (const file of files) {
    const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    writeFileSync(file, lines.join("\n"));
  }
}

/** Yocto to a NEAR string with every digit kept (no rounding, no floats). */
export function nearText(yocto: bigint): string {
  const whole = yocto / 10n ** 24n;
  const frac = (yocto % 10n ** 24n).toString().padStart(24, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
