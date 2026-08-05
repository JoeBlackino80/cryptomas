# Game Design Document: CryptoMas Duel Arena

## 1. Overview

**Name:** CryptoMas: Duel Arena  
**Genre:** Real-time 1v1 Top-down Hero Brawler  
**Platforms:** iOS, Android, WebGL, PC (Windows/Mac)  
**Monetization:** CMAS token staking (no ads, no pay-to-win)  
**Session Length:** 2 minutes  
**Target Audience:** Competitive mobile gamers, crypto-curious players, esports viewers

---

## 2. Core Loop

```
[LOGIN] → [QUEUE] → [HERO SELECT] → [DUEL 2min] → [REWARD/LOSS] → [UPGRADE/HUB] → [REPEAT]
```

### 2.1 Queue & Matchmaking
- Player clicks "PLAY"
- System finds opponent within ±100 ELO points
- Both players stake CMAS (must confirm in embedded wallet)
- Match starts in < 3 seconds

### 2.2 Hero Select (10 seconds)
- 3 random heroes offered to each player
- Heroes have unique abilities but NO stat advantages in base form
- Rarer heroes have COOL cosmetic effects, not power

### 2.3 The Duel (2 minutes)
- Top-down arena, 1 virtual joystick + 2 ability buttons
- Arena shrinks over time (battle royale ring)
- Collect orbs → Charge ultimate → Use at right moment
- Last hero standing wins

### 2.4 Reward Distribution
- Winner: 85% of total pot
- Loser: 0%
- Platform: 15% fee (5% burn, 10% treasury)

---

## 3. Heroes (Characters)

### Free Heroes (Rotation)
| Hero | Role | Ability 1 | Ability 2 | Ultimate |
|------|------|-----------|-----------|----------|
| Ash | Rusher | Dash | Shield Bash | Fire Charge |
| Ivy | Trapper | Root Trap | Poison Cloud | Vine Prison |
| Spark | Mage | Lightning Bolt | Teleport | Storm Nova |

### Rare Heroes (500 CMAS or unlock)
| Hero | Role | Unique Mechanic |
|------|------|---------------|
| Phantom | Assassin | Invisible for 2s after dash |
| Titan | Tank | Reflects 30% damage back |
| Frost | Control | Freezes ground, slows enemies |

### Legendary Heroes (Tournament rewards only)
| Hero | Source | Status Symbol |
|------|--------|---------------|
| Void Dragon | Monthly Champion | Spectators tip more when you play it |
| Celestial | Season 1 Winner | Never available again |

---

## 4. Game Modes

### Quick Duel
- Stake: 25 CMAS
- Random hero from free pool
- Best for: Learning, quick sessions

### Standard
- Stake: 100 CMAS
- Draft pick (ban 1 hero each)
- Best for: Regular play

### High Stakes
- Stake: 500 CMAS
- ELO ranked, leaderboard tracked
- Best for: Serious players

### Whale Room
- Stake: 2,000 CMAS
- VIP queue, instant matchmaking
- Best for: High rollers

### Tournament Bracket
- Entry: 100-1,000 CMAS
- 32/64/128 players, elimination
- Winner takes massive prize + NFT hero

### 2v2 Guild Wars
- Entry: 100 CMAS per player
- Clan vs Clan, weekly
- Trophy NFT for winning guild

---

## 5. Progression Systems

### Player Level (XP)
- Gain XP from every duel (win or lose)
- Unlock: New hero slots, custom emotes, profile frames

### Hero Mastery
- Play hero → Gain mastery points
- Mastery 1-10: Cosmetic upgrades only (skin variations)
- Mastery 10+: Title "Grandmaster [HeroName]"

### ELO Ranking
- Start: 1000 ELO
- Win: +15-30 ELO (based on opponent skill)
- Lose: -10-20 ELO
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster

### Seasonal Resets
- Every 3 months
- Soft reset: ELO compressed toward 1000
- New Battle Pass, new hero, new map
- Previous season rewards become unobtainable (FOMO)

---

## 6. Economy Inside Match

### Orbs (in-match currency, not CMAS)
- Red Orb: +10% damage (30s)
- Blue Orb: +20% speed (30s)
- Gold Orb: Instant ultimate charge
- Green Orb: Heal 25% HP

### Arena Shrinking
- Starts at 30x30 units
- After 60s: shrinks to 20x20
- After 90s: shrinks to 10x10
- Forces confrontation, no camping

---

## 7. Spectator & Betting

### Watch Mode
- Anyone can watch live duels
- Chat, emotes, "hype" reactions
- Top 100 duels featured on main screen

### Betting (Spectators)
- Stake CMAS on which player wins
- Minimum: 10 CMAS
- Odds based on ELO difference
- Fee: 10% (5% burn, 5% treasury)
- **Even non-players buy CMAS to bet**

---

## 8. Anti-Cheat

| Layer | Method |
|-------|--------|
| Server Authority | Client sends inputs only; server calculates all positions/damage |
| Replay Validation | Every match hash stored on-chain; verifiable |
| ELO Monitoring | Sudden ELO spikes trigger manual review |
| Device Fingerprint | Multi-accounting detection |
| Report System | Players report suspicious behavior; AI + human review |

---

## 9. Art Style

- **2D top-down** with slight perspective
- **Neon / Cyber-fantasy** aesthetic
- **Particle effects** for abilities (satisfying feedback)
- **60 FPS target** on mid-range mobile
- **Under 50MB** initial download

---

## 10. Roadmap

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Alpha | Month 1-2 | 1 hero, 1 map, 1v1, no stakes (testnet) |
| Beta | Month 3-4 | 5 heroes, 3 maps, CMAS staking, mobile apps |
| Launch | Month 5 | 10 heroes, tournaments, NFT heroes, full release |
| Season 1 | Month 6-8 | Guild wars, spectator betting, esports partnerships |

---

*Document version: 1.0*  
*Author: CryptoMas Team*
