# Setup

## Needs

- Node 20 or newer, pnpm
- Rust and `cargo-near` for contracts
- Postgres 14 or newer (local, or Neon)

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | What |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `NEAR_NETWORK` | `testnet` or `mainnet` |
| `NEAR_RPC_URL` | RPC endpoint for that network |
| `NEAR_GAME_ACCOUNT` | Account that owns the contracts |
| `NEAR_GAME_PRIVATE_KEY` | Key for that account (server only) |
| `NEAR_RELAYER_ACCOUNT`, `NEAR_RELAYER_PRIVATE_KEY` | Account that pays gas for players (`pnpm chain:setup` makes it) |
| `NEXT_PUBLIC_NEAR_EXPLORER_URL` | Optional: explorer base URL for links |
| `NEAR_AI_URL`, `NEAR_AI_API_KEY` | NEAR AI Cloud base URL and key |
| `NEAR_AI_MODEL`, `NEAR_AI_LISTEN_MODEL` | Model ids for slime minds and for speech to text |
| `ONECLICK_URL`, `ONECLICK_JWT`, `ONECLICK_REFERRAL` | NEAR Intents 1Click base URL, optional partner key and referral |
| `ELEVENLABS_URL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL` | Voices (model optional: else the cheapest listed) |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTH_URL` | Email and Google sign in |
| `SESSION_SECRET`, `KEYS_SECRET` | 32 random bytes each, base64 |

No address, model or NEAR amount is written in the code: each comes from these settings or live from the network and services.

Never commit `.env.local`. Never print keys in logs.

## Contracts

```sh
pnpm contracts:build
pnpm contracts:test
pnpm chain:cost <game account> [testnet|mainnet]   # live cost to open the town and per player
pnpm contracts:deploy                              # nft.<game>, items.<game>, town.<game>
pnpm chain:setup                                   # relayer and shops
```

Accounts are funded with exactly their storage at the live price. When a contract, the relayer or a shop ledger runs short, the game sends just the missing amount.

## Run

```sh
pnpm install
pnpm db:migrate
pnpm seed          # starter shops, items and 50 AI slimes
pnpm dev
pnpm ticker        # in a second terminal: runs the town
```

## Deploy

- App: Vercel, with the same environment variables.
- Ticker: a Vercel cron job, or a small always-on worker.
- Database: Neon.
