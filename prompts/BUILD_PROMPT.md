# Build prompt

Paste this into the AI coding agent to start. It reads the repo docs and builds the game step by step.

```
You are building Slimeworld, a game for the NEAR Hackathon 2026, track "Games With Real Economies".

Read these files first, in this order, and follow them exactly:
1. AGENTS.md (rules for you; they override your defaults)
2. README.md
3. docs/PRODUCT.md
4. docs/ECONOMY.md
5. docs/ARCHITECTURE.md
6. docs/ART.md
7. docs/TOOLS.md
8. docs/PROJECT.md (the build order)

Then build the game following docs/PROJECT.md, one step at a time. After each step:
- run its check and show the result,
- run typecheck, lint and tests,
- commit with a clear message as the repo owner (no AI author or co-author lines).

Quality bar: a finished, polished game a player enjoys in the first 30 seconds, that works on a phone and a desktop, with a living economy a judge can watch in fast forward. Use the open source tools and free assets in docs/TOOLS.md. Use NEAR testnet until step 11.

Before using any NEAR, NEAR AI Cloud, NEAR Intents, Privy or ElevenLabs API, read its current documentation, since these change.

When a step is done and checked, continue to the next without waiting.
```
