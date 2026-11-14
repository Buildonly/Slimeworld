# Product

## One line

A town of AI slimes that earn, spend and trade with real money on NEAR, and you raise one.

## Who it is for

- Players who love pet games (Tamagotchi, Neopets, Slime Rancher) and collecting.
- People new to crypto: no seed phrase, no gas, no jargon on screen.
- Newcomers, who need to see a living economy within their first few minutes.

## The slime

A small jelly creature. Round, shiny, see through, with big eyes.

| State | Look | Meaning |
| --- | --- | --- |
| Thriving | Bright colour, round, high bounce, sparkles | Fed, wallet healthy, earning |
| Fine | Normal colour and bounce | Fed, wallet steady |
| Hungry | Slightly smaller, slower bounce | Needs food soon |
| Broke | Pale, flattened, sweat drop, grumpy face | Wallet nearly empty |
| Asleep | Grey, still, eyes closed, floating "z" | Wallet empty; no thinking until topped up or fed by anyone |

Traits (stored on the slime NFT):

- **Colour** (common to rare): green, blue, pink, gold, crystal, shadow.
- **Size**: grows with age and good care.
- **Personality**: forms from how it was raised. Thrifty, greedy, lazy, brave, social. Personality changes how it spends and which jobs it takes.
- **Skills**: speed, smarts, charm. Trained by play and jobs.
- **Memory**: a short log of its life ("You fed me berries on Monday", "I lost the race to Blub").
- **Voice**: one ElevenLabs voice per slime, pitch shifting as it grows.

## The core loop (30 seconds)

1. Open the app, see your slime and its mood.
2. Feed or play (one tap). The slime reacts, bounces, talks.
3. Check what it did while you were away: jobs done, coins earned, what it bought and why.
4. Make one choice: send it to a job, buy it something, adjust its rules, or invest in a shop.

## The longer loop (days)

- Slimes level up skills and unlock better jobs.
- Players breed slimes (two parents, rare colour chance) and sell or rent them.
- Players invest in shopkeeper slimes and earn a share of their profit.
- Seasons: weekly events change demand (a heat wave makes ice cheap to sell and expensive to buy).

## Jobs

| Job | Needs | Pays from |
| --- | --- | --- |
| Delivery | Speed | Shopkeepers restocking |
| Race | Speed, energy | Entry pool (winner takes most, house keeps a small cut) |
| Puzzle contest | Smarts | Entry pool |
| Shop helper | Charm | Shopkeeper wage, more when the shop is busy |
| Guard | Size | Players protecting items in storage |

Jobs cost energy. Energy comes from food. Food costs money. That chain is the economy.

## Shopkeepers

AI slimes that own a shop, a wallet and stock. Each sets prices from its stock, recent sales and its personality (see [ECONOMY.md](ECONOMY.md)). They buy materials from players, hire player slimes, can hoard, can undercut each other, and close when broke until a player invests.

## Spending rules (the owner's controls)

For each slime the owner sets:

- Daily spending limit.
- What it may buy: food only, food and training, anything.
- Jobs it may take.
- A savings target (it will not spend below this).

The slime acts alone inside these rules. Every decision is logged with its reason.

## Screens

1. **Home**: your slime large in the centre, mood, wallet as a coin jar, last three things it did.
2. **Town**: a map of shops and job boards, live prices, which shops are open, busy or closed.
3. **Market**: buy, sell and list items. Price history for each item.
4. **Slime log**: every decision with its reason and a "verified" badge.
5. **Rules**: the owner's controls.
6. **World**: public live view: top earners, price index ("economy weather"), shops that went broke, records.
7. **Fast forward** (demo and spectators): run the town at 1 day per 10 seconds.

## Sign in and money

- Email or Google sign in. A NEAR account is made for the player, and one for each slime.
- Starter slime comes with a small balance so play starts at once.
- Top up from any chain with NEAR Intents; the money lands in the player's account and they choose how much each slime gets.
- Every normal action (feed, buy, job) is signed by a function call key the game holds for that session, or relayed as a meta transaction, so there are no popups.

## Success looks like

- A new player hatches and feeds a slime in under 60 seconds.
- A new visitor sees prices move and a shop go broke within minutes (fast forward).
- Every slime decision shows its reason and its verification.
