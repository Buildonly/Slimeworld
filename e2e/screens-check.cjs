/**
 * Step 8 check: every screen works on a 390 px phone and on desktop, in light
 * and dark. Signs in (test sign in), hatches a slime if needed, then for each
 * screen checks for page errors, horizontal overflow and visible content,
 * and saves a screenshot.
 *   node e2e/screens-check.cjs <out dir>
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || "test-results/screens";
const SCREENS = [
  { path: "/", expect: "Wallet" },
  { path: "/town", expect: "Town news" },
  { path: "/market", expect: "Market" },
  { path: "/log", expect: "log" },
  { path: "/rules", expect: "Daily spending limit" },
  { path: "/world", expect: "Economy weather" },
  { path: "/fast", expect: "Fast forward" },
];
const SETUPS = [
  { name: "phone-light", viewport: { width: 390, height: 844 }, colorScheme: "light" },
  { name: "phone-dark", viewport: { width: 390, height: 844 }, colorScheme: "dark" },
  { name: "desktop-light", viewport: { width: 1280, height: 800 }, colorScheme: "light" },
  { name: "desktop-dark", viewport: { width: 1280, height: 800 }, colorScheme: "dark" },
];

(async () => {
  require("fs").mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let failures = 0;
  for (const setup of SETUPS) {
    const ctx = await browser.newContext({ viewport: setup.viewport, colorScheme: setup.colorScheme });
    const p0 = await ctx.newPage();
    await p0.goto(BASE);
    await p0.evaluate(async () => {
      await fetch("/api/session/dev", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "screens-check@example.com" }) });
      const home = await (await fetch("/api/home")).json();
      if (!home.slimes?.length) await fetch("/api/slimes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Mochi" }) });
    });
    await p0.close();
    for (const s of SCREENS) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !/synchronously unmount a root/.test(m.text())) errors.push(m.text());
      });
      await page.goto(BASE + s.path, { waitUntil: "load" });
      let found = true;
      try {
        await page.getByText(s.expect, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 25000 });
      } catch {
        found = false;
      }
      await page.waitForTimeout(1500);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      const overflow = width > setup.viewport.width;
      await page.screenshot({ path: `${OUT}/${setup.name}${s.path.replace(/\W/g, "-") || "-home"}.png`, timeout: 60000 });
      const ok = found && !overflow && errors.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? "PASS" : "FAIL"}  ${setup.name.padEnd(14)} ${s.path.padEnd(8)} ${found ? "" : "missing content; "}${overflow ? `overflow ${width}px; ` : ""}${errors.slice(0, 2).join(" | ")}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} failures` : "\nAll screens pass on phone and desktop, light and dark.");
  process.exit(failures ? 1 : 0);
})();
