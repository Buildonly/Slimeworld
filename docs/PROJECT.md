# Project plan

Build in this order. Each step ends with a check that must pass before the next one starts. The game must be playable end to end after step 6; everything after makes it better.

## 1. Skeleton
- Next.js + TypeScript app, Postgres, `.env.example`, lint and typecheck scripts.
- **Check:** `pnpm dev` shows a page; `pnpm typecheck` passes.

## 2. Sign in and accounts
- Email and Google sign in (Privy or NEAR's own social login). Create a NEAR account per player on testnet.
- **Check:** a new email signs in and sees its NEAR account id.

## 3. Contracts on testnet
- `slime.nft` (NEP-171), `items.mt` (NEP-245), `town` (shops, jobs, rules, treasury). Unit tests with near-workspaces.
- **Check:** tests pass; contracts deployed to testnet; mint a slime and an item from a script.

## 4. The slime on screen
- Three.js scene, one slime with squash and stretch, the five states from PRODUCT.md, colour by trait.
- **Check:** switching state in a debug panel changes look and bounce.

## 5. Economy core
- `src/economy/config.ts` and `pricing.ts`, the ticker, shops, jobs, food and energy.
- `pnpm sim` runs it headless.
- **Check:** a 30 day simulation keeps prices inside 0.5× to 3× base and shows at least one shop closing and reopening.

## 6. Minds
- NEAR AI Cloud client, prompts in `prompts/`, JSON schema validation, signature check, cost charged to the slime.
- **Check:** a slime makes 10 decisions in a row, each logged with reason, cost and verified flag.

## 7. Gasless play
- Relayer for meta transactions, or session function call keys limited to the town contract.
- **Check:** feed, buy and job actions complete with no wallet popup.

## 8. Screens
- Home, Town, Market, Slime log, Rules, World, Fast forward.
- **Check:** every screen works on a phone (390 px wide) and desktop, light and dark.

## 9. Voice
- ElevenLabs voices per slime, cached lines, mic input with Whisper or browser speech.
- **Check:** say "how are you" and the slime answers in its voice with its real mood.

## 10. Top ups from any chain
- NEAR Intents 1Click: quote, deposit address, status.
- **Check:** a small USDC top up from Base lands in the player's account.

## 11. Mainnet
- Deploy contracts to mainnet, switch config, small real balances.
- **Check:** one full loop on mainnet: hatch, feed, job, earn, spend.

## 12. Polish and demo
- Sound, particles, onboarding in three taps, the World screen live.
- Record the demo per [DEMO.md](DEMO.md). Submit per [SUBMISSION.md](SUBMISSION.md).

## Definition of done
- A new player plays the full loop in under two minutes without help.
- Fast forward shows a week of the economy in a minute.
- Every slime decision is logged, explained and verified.
- No seed phrase and no gas popup during normal play.
- Repo has README, docs, tests, `.env.example`, and a live link.
