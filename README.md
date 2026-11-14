# Slimeworld

Raise a slime that earns its own living.

Every slime in Slimeworld is a small AI creature with its own wallet on NEAR. It eats, works, shops, saves and can go broke. Feed it and train it, and it grows bright, round and clever. Leave it alone too long and it runs out of money, goes pale and flat, and finally falls asleep until someone looks after it again.

The economy is the game. Slimes buy food from shopkeeper slimes, take jobs, race, and trade with each other. Prices move with supply and demand. Nobody patches the economy by hand: it runs on its own, driven by players and by the slimes themselves.

Players never see a seed phrase or a gas prompt. Sign in with email or Google and play.

## Built for

NEAR Hackathon 2026, track **Games With Real Economies**. Also fits **NFTs That Do Something**: each slime is an NFT that is also its own account, holding money and items.

## How to play

1. **Hatch.** Sign in with email or Google. You get your first slime and a little NEAR to start it off.
2. **Care.** Feed it, play with it, train it. Food and toys are items you buy or craft.
3. **Let it work.** Your slime takes jobs on its own: deliveries, races, puzzle contests, helping a shop. It earns into its own wallet.
4. **Watch it decide.** It spends its earnings by itself, within the rules you set, and tells you why: "Bought berries: cheapest food today, 14 left in stock."
5. **Talk to it.** Every slime has its own voice and remembers how you treated it.
6. **Grow the town.** Invest in shops, breed rare colours, rent your slime to other players, or open a stall of your own.

## What makes it different

- **Slimes that pay their own way.** Each slime pays for its own thinking on NEAR AI Cloud from its own wallet. A rich slime thinks more and does more.
- **The money state is visible.** Colour, shape and bounce show how a slime is doing, with no numbers needed.
- **Verified minds.** Slime decisions run in secure hardware on NEAR AI Cloud, and each one carries a signature the game checks and shows as a badge.
- **Spending rules you control.** Daily limits and allowed shops for each slime, so it can act alone and stay safe.
- **Voices.** ElevenLabs gives every slime a voice that changes as it grows. Speak to it and it answers.
- **A town that lives without you.** Shopkeepers set prices from stock and demand, hoard, go bankrupt and reopen when someone invests.
- **Fast forward.** One button plays a week of the economy in a minute, so anyone can watch it move.
- **Top up from any chain.** Pay with USDC on Base, SOL, ETH and more through NEAR Intents.

## NEAR technology

| Piece | Used for |
| --- | --- |
| NEAR accounts | One account per slime, so every slime holds its own money and items |
| NEP-245 multi-token | Every item (food, toys, hats, materials) in one contract |
| NEP-171 NFT | The slime itself, linked to its account |
| NEAR AI Cloud | Each slime's mind, with verifiable signatures |
| NEAR Intents (1Click API) | Top-ups from any coin on any chain |
| Meta transactions (NEP-366) and function call keys | No gas prompts and no wallet popups in normal play |
| Email and Google sign in | No seed phrases |

## Contracts

Three contracts live under the game account you choose (`NEAR_GAME_ACCOUNT`):

| Contract | Account | Standard |
| --- | --- | --- |
| Slimes | `nft.<game account>` | NEP-171 |
| Items | `items.<game account>` | NEP-245 |
| Town | `town.<game account>` | Coins, rules, shops, jobs, treasury |

These contracts run on testnet, where coins are play money with no cash value. The public **Fair play** page (`/proof`) shows live numbers from the town contract and real transactions where it refused cheats; `pnpm proofs` records fresh ones.

On mainnet the game needs no contract and no NEAR to open: top ups from any chain go through NEAR Intents 1Click straight into the game treasury's Intents balance (`TOPUP_TREASURY_ACCOUNT`, made by `pnpm treasury:key`), and the player gets coins for exactly what was delivered. Players can start as guests, with no email and no wallet.

What running the testnet town costs is worked out live from the network's own prices: `pnpm chain:cost <game account>`. Nothing is fixed in code; accounts get exactly their storage, and the game tops up any of its accounts by just what it is short.

Source in [contracts/](contracts/). `pnpm contracts:test` runs the unit tests; CI also runs a sandbox end-to-end test.

## Run it

```sh
git clone <repo> && cd <repo>
pnpm install
cp .env.example .env.local      # fill in the values listed in docs/SETUP.md
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```

Full setup, contracts and keys: [docs/SETUP.md](docs/SETUP.md).

## Documents

| File | What it covers |
| --- | --- |
| [docs/PRODUCT.md](docs/PRODUCT.md) | The game: slimes, loop, economy, screens |
| [docs/ECONOMY.md](docs/ECONOMY.md) | Pricing, jobs, wages, bankruptcy, balancing |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the parts fit: frontend, backend, contracts, agents |
| [docs/PROJECT.md](docs/PROJECT.md) | Build plan in order, with checks for each step |
| [docs/TOOLS.md](docs/TOOLS.md) | Open source tools, free assets and services |
| [docs/ART.md](docs/ART.md) | Slime look, Blender steps, animation, sound |
| [docs/SETUP.md](docs/SETUP.md) | Keys, environment, deploy |
| [docs/DEMO.md](docs/DEMO.md) | The demo video script |
| [docs/SUBMISSION.md](docs/SUBMISSION.md) | Hackathon submission text and checklist |
| [AGENTS.md](AGENTS.md) | Instructions for AI coding agents working on this repo |
| [prompts/](prompts/) | The prompts each slime and shopkeeper runs on |

## License

MIT
