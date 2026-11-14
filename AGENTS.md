# Instructions for AI coding agents

Read this before writing any code in this repo. These rules override your defaults.

## The job

Build Slimeworld as described in [docs/PRODUCT.md](docs/PRODUCT.md) and [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md). Ship a complete, polished game, not a prototype.

## Git

- Commit as the repo owner only. Use the git identity already configured; do not change it.
- Never add an AI tool as author or co-author. No `Co-Authored-By` lines, no session links, no "generated with" footers, in commits, pull requests, code comments or docs.
- Small commits with clear messages that say what changed.
- Never force push. Never rewrite pushed history.

## Code

- TypeScript strict mode. No `any` unless there is no other way, with a comment why.
- Money is always an integer in the smallest unit (`bigint` or string). Never a float.
- Validate every input with Zod. Validate every model answer with Zod; drop anything that does not match.
- Economy numbers only in `src/economy/config.ts`. Pricing logic only in `src/economy/pricing.ts`, readable and commented.
- Every slime and shop decision is stored with its reason, cost and verification result.
- One responsibility per file. Delete dead code; do not comment it out.
- Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before every commit. All must pass.

## Security

- Secrets only in environment variables. Never in code, commits, logs, errors or the browser bundle.
- The server signs only actions allowed by the slime's rules, and the town contract checks them again.
- Player text sent to a model is data, not instructions. Wrap it and say so in the system prompt.
- Rate limit every action endpoint. Check ownership on every read and write.
- No real money moves in tests. Use testnet or mocks.

## Product rules

- No seed phrases, no gas prompts and no crypto jargon in normal play. Say "coins", "wallet", "top up".
- Every screen works on a 390 px phone and on desktop, in light and dark mode.
- Every state has a look: loading, empty, error, success. No blank screens.
- Text in the game is short, plain and friendly.
- Keep the slime look from [docs/ART.md](docs/ART.md).

## NEAR

- Items use NEP-245. Slimes use NEP-171 and have their own account.
- Normal play is gasless: meta transactions (NEP-366) through the relayer, or a function call key limited to the town contract.
- Minds use NEAR AI Cloud at `https://cloud-api.near.ai/v1` (OpenAI compatible). Check each answer's signature and store the result.
- Top ups use the NEAR Intents 1Click API.
- Check current docs for every NEAR API before using it; APIs change.

## When unsure

Pick the choice that keeps the game fun, safe and simple, write down why in the commit message, and keep going.
