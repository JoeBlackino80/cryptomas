# Game Design Document: Orbit Rush

## 1. Overview

**Name:** CryptoMas: Orbit Rush
**Genre:** One-touch skill arcade / daily challenge
**Platforms:** Web (instant play, no install), iOS, Android, Telegram Mini App
**Session Length:** 60 seconds per run
**Monetization:** CMAS ecosystem (async staked duels, tournaments) — no ads in core loop, no pay-to-win
**Target Audience:** Everyone with a phone. No language, no controls barrier, no install barrier.

Orbit Rush is the mass-market front door of the CryptoMas ecosystem. Duel Arena
(see `GDD.md`) targets competitive players; Orbit Rush targets *everyone else*
and funnels the competitive slice into staked play.

---

## 2. Why This Has Worldwide Appeal

Every global arcade phenomenon (Flappy Bird, Wordle, Subway Surfers, Agar.io)
shares the same five properties. Orbit Rush is designed from these properties
backwards:

| Property | Orbit Rush implementation |
|----------|---------------------------|
| **Zero language barrier** | No text needed to play. One verb: tap. |
| **One-thumb control** | Playable on a bus, in a queue, one-handed. |
| **< 1 second restart** | Death → new run instantly. No menus, no loading. |
| **Daily shared ritual** | One deterministic daily track for the whole planet (Wordle model). |
| **Shareable result** | Emoji score-card copied in one tap ("🪐 Orbit Rush #214 — 4,820 ⚡ streak 12"). |
| **Skill ceiling** | Easy to latch, hard to chain perfect releases. Top-1% play looks superhuman. |

And one property the classics did *not* have:

- **Asynchronous head-to-head.** Because the track is deterministic, two players
  can duel *without being online at the same time* — both play the same seed,
  higher score wins. This solves the matchmaking-liquidity problem that kills
  most real-time 1v1 games at launch, and makes every match replay-verifiable.

---

## 3. Core Mechanic

You are an orb. The orb automatically orbits the nearest **anchor**.

- **Tap / hold nothing:** orb keeps circling its current anchor.
- **Tap:** orb releases and flies off along the tangent.
- Fly close to the next anchor → auto-latch, start orbiting it.
- Miss every anchor, drift off-track, or hit a hazard → run over. Tap to retry.

That's the entire control scheme. Mastery is *when* you release:

- **Chain:** every successful anchor-to-anchor hop builds a combo multiplier.
- **Sparks (⚡):** placed along the ideal flight lines. Collecting them scores
  points × combo. A perfect release threads a line of sparks.
- **Hazards:** counter-rotating spike satellites on some anchors, and dead
  anchors that expire after one orbit. Reading them ahead is the skill.
- **Gates (checkpoints):** every 5th ring is a gate (visually distinct, never
  hazardous). Dying does NOT end the run — after a 1.25 s pause you respawn at
  the last gate and the 60 s timer keeps running. The cost of a death is lost
  time, a combo reset, and the climb back. Casual players always get their
  full minute and keep their progress; they never start from zero.
- **Anti-farm rule:** points, combo growth and gate bonuses are awarded only
  for *new* territory (rings beyond the highest one reached). Re-climbing
  after a death scores nothing, so deliberate deaths can never inflate score —
  the leaderboard stays a pure skill measure.
- **The track climbs.** Score = new rings × combo + sparks × combo + gate
  bonuses. Every run lasts exactly 60 seconds — never longer than a coffee sip.

---

## 4. Core Loop

```
[OPEN LINK] → [DAILY TRACK 60s] → [SCORE + SHARE CARD] → [RETRY / DUEL] → [REPEAT]
```

- **No account required to play.** First run is 3 seconds after link-click.
  Wallet/account only when the player wants streaks synced, duels, or rewards.
- **Daily Track:** one seed per UTC day, identical for every player on Earth.
  Unlimited attempts; your best counts. Resets at 00:00 UTC → built-in daily
  appointment mechanic.
- **Practice mode:** infinite random seeds, no stakes, instant.

---

## 5. Retention Systems

### Streaks
- Play the daily at least once → streak +1 (playing counts, not winning —
  streaks must be *protectable by effort*, never by payment).
- Streak milestones (7 / 30 / 100 / 365) award cosmetic orb trails & badges.

### Ghosts
- Your best run of the day is recorded as an input log (a few KB).
- Race translucent ghosts: your own best, your friends' bests, the world #1.
- Chasing a friend's ghost is the single strongest "one more try" driver.

### Leagues (weekly)
- Bronze → Grandmaster, 30-player brackets, weekly promotion/demotion
  (Duolingo model). Sum of your 7 daily bests = league score.

### Share Card
- One tap copies a spoiler-free emoji card. The card *is* the marketing:
  every share is a challenge to beat a specific number on the same track.

### Seasonal content
- New hazard types, biome skins, and music every 6 weeks. The mechanic never
  changes; the reading puzzle does.

---

## 6. CMAS Integration (funnel, not gate)

The free game is complete without crypto. CMAS adds competitive layers on top:

| Layer | Description | Fee |
|-------|-------------|-----|
| **Async Duel** | Challenge anyone (link/QR). Both stake CMAS, both play today's seed, 3 attempts each, best score wins the pot. | 15% (5% burn, 10% treasury) |
| **Gauntlet** | Daily 100-player bracket, fixed CMAS entry, top 10 paid. | 10% |
| **Ghost Bounty** | Post your run + a bounty; first player to beat it takes the bounty. Unclaimed 24h → returned minus fee. | 10% |
| **Cosmetics** | Trails, orb skins, victory bursts. Pure cosmetics, some tournament-exclusive (status, not power). | — |

Anti-cheat is *structurally* simpler than Duel Arena's: the game is
deterministic, so a submitted input log can be re-simulated server-side and
must reproduce the claimed score exactly. Replays of staked matches are
hash-anchored on-chain, same as `duel_contract.md`.

### Player-protection guardrails
Engagement must come from mastery, ritual, and social play — not from loss-chasing.
- All staked modes are 18+ with KYC (see `compliance.md`); the free game is stake-free and unlimited.
- Daily and weekly stake caps per account, user-lowerable, raises take 72h to apply.
- No stakes on first-session players; duels unlock after 7 play-days.
- Streaks, leagues and cosmetics never require spending; losses are capped at the stake — no "double or nothing" re-prompts after a lost duel.

---

## 7. Operator Economics

How the platform (and the CMAS treasury) earns from Orbit Rush. All figures in
CMAS — fiat value depends on token price. Fee splits follow `TOKENOMICS.md`.

### 7.1 Direct revenue streams

| Stream | Fee | Treasury | Burn |
|--------|-----|----------|------|
| Async Duel | 15% of pot | 10% | 5% |
| Gauntlet (daily 100-player bracket) | 10% of entries | 5% | 5% |
| Ghost Bounty | 10% of bounty | 5% | 5% |
| Cosmetics (trails, orb skins) | 100% of price | 50% | 50% |

### 7.2 Scenario model

Model: `staked volume/day = payers × duels/day × stake`. Each duel pots two
stakes (fee is charged per pot, so volume is counted per player-stake, not
double-counted per duel). Duel fee 15% → treasury 10%, burn 5%.

| Assumption | Pessimistic | Realistic | Optimistic |
|------------|------------:|----------:|-----------:|
| Daily active users (free) | 5,000 | 50,000 | 500,000 |
| Conversion to staked play | 1% | 3% | 4% |
| Staked players | 50 | 1,500 | 20,000 |
| Duels per payer per day | 2 | 3 | 4 |
| Avg stake per player | 25 CMAS | 50 CMAS | 50 CMAS |
| **Staked volume / day** | **2,500** | **225,000** | **4,000,000** |
| Platform fee / day (15%) | 375 | 33,750 | 600,000 |
| → Treasury / day | 250 | 22,500 | 400,000 |
| → Burn / day | 125 | 11,250 | 200,000 |
| **Treasury / month** | **~7,500** | **~675,000** | **~12,000,000** |
| Burn / year (% of 1B supply) | ~0.005% | ~0.4% | ~7.3% |

Gauntlet, Ghost Bounties and cosmetics are additive on top of duels; a
conservative planning assumption is +20–30% over the duel figures. The
optimistic burn rate (~7%/yr) is consistent with the 30–40%/36-month
deflation target in `TOKENOMICS.md` when combined with Duel Arena volume.

### 7.3 Indirect value (usually the bigger lever)

1. **Token demand.** Competing for stakes requires buying CMAS. The free game
   is the acquisition funnel; without it, demand would have to be bought with
   ad spend.
2. **Deflation.** Every duel burns 5% of the fee, cosmetics burn 50%. Rising
   play volume shrinks circulating supply, which benefits all long-term
   holders — including the Team (15%) and Treasury (5%) allocations.
3. **Zero-cost viral acquisition.** The share card is marketing performed by
   players; saved user-acquisition cost is de-facto profit.
4. **Cross-sell.** Top Orbit Rush players graduate into Duel Arena's higher
   per-player fee modes (High Stakes, Whale Room, tournaments).

### 7.4 Risks & honest caveats

- **Revenue is denominated in CMAS.** Fiat value of treasury income rises and
  falls with the token. Sustained value requires demand driven by actual play,
  not speculation; treasury sell-pressure must be gradual and partly recycled
  into rewards, or it undermines its own asset.
- **Conversion is the sensitive variable.** 1–5% free-to-paid is the industry
  norm; the realistic scenario assumes the upper-middle of that range and only
  works at tens of thousands of DAU. Everything in the design (zero-barrier
  entry, share loop) exists to make DAU the solved problem.
- **Regulatory.** Staked head-to-head play may be treated as wagering in some
  jurisdictions — see `compliance.md` (18+, KYC, geoblocks, gaming counsel).
  Fixed-entry Gauntlets and cosmetics are the regulatorily safer streams,
  which is why the model leans on them growing over time.
- Scenario figures are planning models, not forecasts or promises of profit —
  keep them out of marketing materials (`compliance.md`: no profit-sharing
  promises).

---

## 8. Technical Design

- **Deterministic fixed-timestep simulation** (120 Hz logic, interpolated
  render). Same seed + same input log = same result on every device. This is
  the foundation of daily tracks, ghosts, async duels, and anti-cheat.
- **Seeded PRNG:** track generation from `hash(date)` (daily) or random
  (practice).
- **Input log:** run = list of tap timestamps (ticks). A full run is < 1 KB.
- **Client:** HTML5 Canvas / WebGL, < 2 MB initial load, playable from a URL,
  Telegram Mini App wrapper for distribution. Native wrappers later.
- **Server:** verification (re-sim of submitted logs), leaderboards, leagues,
  duel escrow via existing custodial wallet system (`server.js`).

A playable prototype of the full verified loop lives in **`PROTOTYPE/`**:

- `sim.js` — the deterministic simulation core, single source of truth shared
  by the browser client and the server verifier.
- `orbit-rush.html` — the game client: records the run as a tap log, submits
  it, shows the global daily leaderboard. Also playable offline from `file://`.
- `orbit-server.js` — verification server + daily leaderboard. Re-simulates
  every submitted tap log; only the server-computed score enters the
  leaderboard, so an inflated claim is structurally impossible.
- `orbit-server.test.js` — determinism, verification, rejection and
  leaderboard-ordering tests (`npm test`).

Run it: `npm install && npm run orbit` → http://localhost:4100

---

## 9. Art & Feel

- Neon-on-dark, matching the CryptoMas cyber-fantasy identity.
- **Juice budget is a feature:** screen-shake on latch, spark burst on collect,
  slow-mo 100 ms on near-miss, pitch-rising collect sound per combo step.
  In one-touch games, feel *is* the game.
- Colorblind-safe palette; hazards differ by shape, never only by color.

---

## 10. Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Prototype | now | Playable core loop (done — `PROTOTYPE/orbit-rush.html`) |
| Alpha | Month 1 | Server verification + daily leaderboard (done — `PROTOTYPE/orbit-server.js`); accounts, ghosts |
| Beta | Month 2 | Leagues, share cards, Telegram Mini App, cosmetics |
| Launch | Month 3 | Async CMAS duels + Gauntlet (18+, KYC), season 1 |
| Growth | Month 4+ | Ghost bounties, creator tracks, cross-promo into Duel Arena |

---

*Document version: 1.0*
*Author: CryptoMas Team*
