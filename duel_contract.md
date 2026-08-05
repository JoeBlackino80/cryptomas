# Smart Contract Spec: Staked Duel

## Overview
On-chain program for trustless 1v1 duel staking, prize distribution, and fee handling.

## Program ID
`TBD after deployment on Solana devnet/mainnet`

## Accounts

### DuelAccount
```rust
pub struct DuelAccount {
    pub player1: Pubkey,           // 32 bytes
    pub player2: Pubkey,           // 32 bytes
    pub stake_amount: u64,         // 8 bytes
    pub player1_staked: bool,      // 1 byte
    pub player2_staked: bool,      // 1 byte
    pub winner: Option<Pubkey>,    // 33 bytes
    pub status: DuelStatus,        // 1 byte
    pub created_at: i64,           // 8 bytes
    pub fee_burned: u64,           // 8 bytes
    pub fee_treasury: u64,         // 8 bytes
}

pub enum DuelStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
}
```

## Instructions

### 1. `create_duel(player1, player2, stake_amount)`
- Creates escrow account holding both stakes
- Requires both players to sign
- Transfers CMAS from both players to escrow

### 2. `submit_result(winner_pubkey, signature)`
- Only callable by authorized oracle (game server)
- Verifies winner via cryptographic signature
- Distributes prize:
  - 85% → winner
  - 5% → burn address
  - 10% → treasury

### 3. `cancel_duel()`
- Only if duel still Pending
- Returns stakes to both players

### 4. `claim_timeout()`
- If duel Active > 10 minutes without result
- Both players get 95% stake back (5% fee)

## Fee Distribution
```
Total Pot = stake_amount × 2
Fee = Total Pot × 15%
  ├── Burn (5%) → CMAS burn address
  └── Treasury (10%) → Dev treasury wallet
Winner Prize = Total Pot - Fee = 85% of pot
```

## Security
- PDA (Program Derived Address) for escrow
- Oracle multisig (3-of-5 game servers)
- Replay protection via unique duel_id
- Timeout mechanism prevents frozen funds

## Deployment
1. Build with Anchor framework
2. Deploy to devnet
3. Audit (recommended: OtterSec or Neodyme)
4. Deploy to mainnet
5. Update Program ID in backend config
