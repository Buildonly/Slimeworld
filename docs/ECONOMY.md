# Economy

All numbers live in one readable file, `src/economy/config.ts`, so they can be tuned without touching logic. Pricing logic lives in `src/economy/pricing.ts`. The game shows each price's reason in a tooltip.

## Money

- Unit: NEAR on testnet for development, NEAR or USDC on mainnet.
- Every amount is stored as an integer in the smallest unit. No floats for money.

## Where money comes from and goes

| In | Out |
| --- | --- |
| Player top ups | Food and toys |
| Job wages | Thinking (NEAR AI Cloud calls, paid per call) |
| Race and contest prizes | Race and contest entries |
| Sales of items and crafted goods | Training, hats, breeding fees |
| Investor share of shop profit | Shop investment |

A small fee on races, breeding and market sales goes to a town treasury that funds seasonal events. This keeps money from piling up forever.

## Shopkeeper pricing

Each item has a base price. A shopkeeper's price for it:

```
price = base
      × stockFactor      // low stock → higher price
      × demandFactor     // sold a lot recently → higher price
      × personality      // greedy 1.15, fair 1.0, generous 0.9
      × seasonFactor     // event multipliers
```

- `stockFactor = clamp(targetStock / max(stock, 1), 0.5, 3)`
- `demandFactor = clamp(1 + (salesLast24h - avgSales) / avgSales × 0.5, 0.7, 2)`
- Buying from players: the shop pays `price × buyMargin` (0.6 by default), lower when it is already full.

Reason shown in the tooltip, for example: "Iron 4 → 2.1: I have 60 iron and only sold 3 today."

## Slime spending

Each tick a slime decides what to do. Cheap rules run first; only real choices go to the AI:

1. If energy is low and food is allowed: buy the cheapest food that fits the budget.
2. If wallet is below the savings target: take the best paying job it can do.
3. Otherwise: ask its AI mind to choose between training, a toy, a race, or saving, given its personality, memory and prices.

Thinking costs money. A rich slime thinks every tick; a poor one thinks less often; an asleep slime does not think at all. This is the "pays for its own mind" loop.

## Jobs and wages

- Shops post jobs with a wage. Busy shops post more and pay more.
- Wage = `baseWage × (1 + shopBusyness)`, capped by what the shop can afford.
- A slime's skill sets its success chance and speed.

## Bankruptcy and recovery

- A shop that cannot pay wages or restock for one full day closes.
- Players can invest to reopen it and receive a share of future profit.
- A slime with an empty wallet falls asleep. Any player can feed it; the feeder earns a "friend" mark and the slime remembers them.

## Balancing targets

- A well cared for slime earns a little more than it costs to keep.
- A neglected slime drifts to sleep in about 3 days.
- No item price leaves the 0.5× to 3× range of its base.
- Treasury fees: 2 to 5 percent.

## Simulation

`pnpm sim --days 30 --slimes 200` runs the economy headless and prints price charts and wealth spread. Run it after every change to the numbers.
