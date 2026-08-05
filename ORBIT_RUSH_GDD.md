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
- **The track climbs.** Score = altitude + sparks × combo. 60-second timer.
  Die early or ride the full minute — the run is never longer than a coffee sip.

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

## 7. Technical Design

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

A playable single-file prototype of the core mechanic lives at
**`PROTOTYPE/orbit-rush.html`** — open it in any browser (mobile or desktop),
tap or press Space. It already implements the daily seed, deterministic
generation, combo scoring, streaks, and the share card.

---

## 8. Art & Feel

- Neon-on-dark, matching the CryptoMas cyber-fantasy identity.
- **Juice budget is a feature:** screen-shake on latch, spark burst on collect,
  slow-mo 100 ms on near-miss, pitch-rising collect sound per combo step.
  In one-touch games, feel *is* the game.
- Colorblind-safe palette; hazards differ by shape, never only by color.

---

## 9. Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Prototype | now | Single-file playable core loop (done — `PROTOTYPE/orbit-rush.html`) |
| Alpha | Month 1 | Server verification, accounts, ghosts, daily leaderboard |
| Beta | Month 2 | Leagues, share cards, Telegram Mini App, cosmetics |
| Launch | Month 3 | Async CMAS duels + Gauntlet (18+, KYC), season 1 |
| Growth | Month 4+ | Ghost bounties, creator tracks, cross-promo into Duel Arena |

---

*Document version: 1.0*
*Author: CryptoMas Team*
