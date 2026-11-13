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
| `NEAR_GAME_ACCOUNT` | Account that owns the contracts |
| `NEAR_GAME_PRIVATE_KEY` | Key for that account (server only) |
| `NEAR_RELAYER_PRIVATE_KEY` | Key that pays gas for players |
| `NEAR_AI_API_KEY` | NEAR AI Cloud key |
| `NEAR_AI_MODEL` | Model id for slime minds |
| `ONECLICK_JWT` | NEAR Intents partner key for top ups |
| `ELEVENLABS_API_KEY` | Voices |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Email and Google sign in |
| `SESSION_SECRET` | 32 random bytes, base64 |

Never commit `.env.local`. Never print keys in logs.

## Contracts

```sh
cd contracts
cargo near build
cargo test
near deploy <slime.nft account> target/near/slime_nft.wasm
near deploy <items.mt account> target/near/items_mt.wasm
near deploy <town account> target/near/town.wasm
```

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
