# Arc Yield Agent — Arc House Community Post

**Title:** Arc Yield Agent: Real-Yield Stablecoin Allocator on Arc Testnet

**Category:** Projects & Builds

---

## Overview

I built **Arc Yield Agent** — an autonomous stablecoin allocator with real on-chain yield streaming on Arc Testnet.

**Live demo:** https://arc-yield-agent.vercel.app
**GitHub:** https://github.com/0xdungki/arc-yield-agent

Three vault strategies, each funded with a real reward pool that streams USDC pro-rata to depositors. APY is calculated live from the on-chain reward rate and current TVL — no hardcoded numbers, no fake yield.

---

## Why Arc?

USDC as native gas is a game-changer for stablecoin products. Users pay transaction fees in the same asset they're allocating — no wrapped tokens, no bridge friction, no mental overhead.

This makes Arc perfect for yield optimization products where the entire flow (deposit, rebalance, withdraw, claim) happens in one asset.

---

## How It Works

The vault contracts use the **Synthetix-style streaming rewards** pattern (battle-tested by Sushi, Aave, and others):

1. **Sponsor funds the pool** — `notifyRewardAmount(amount)` streams USDC over a fixed duration (14 days)
2. **Users deposit USDC** — receive vault shares 1:1, start earning pro-rata rewards immediately
3. **APY calculated live** — `rewardRate × SECONDS_PER_YEAR / totalSupply`, all on-chain
4. **Claim anytime** — `claim()` harvests accrued rewards; `withdraw()` auto-claims + returns principal

When TVL is low, APY shows projected rate at 100 USDC. As more users deposit, APY adjusts down (finite pool divided across more shares).

---

## Tech Stack

- **Contracts:** Hardhat + OpenZeppelin (StreamingYieldVault, MockUSDC)
- **Frontend:** Vanilla JS + ethers.js (no framework bloat)
- **Design:** Editorial luxury aesthetic (anti-cyberpunk)
- **Deploy:** Vercel static hosting
- **Bundle:** ~42 KB total (HTML 8.7K + CSS 17K + JS 14K)

---

## Deployed Contracts (Arc Testnet, May 16 2026)

- **MockUSDC:** `0xfd483B685d9f291606b9f70511E13436c091274E`
- **Cash Reserve Vault** (7 USDC pool, 14d): `0xd75451A8934704e3229692Cb04D42C494Dfc87C7`
- **Lending Markets Vault** (14 USDC pool, 14d): `0x63Ec96081521DB57ADce4870B5a478b2c4dC726b`
- **Real-World Assets Vault** (21 USDC pool, 14d): `0xc9a089B6D0327d0bFA0429156014F6DD209d199C`
- **Deployer / Sponsor:** `0x86563098801D6Fc60a4250911d2037CEc2172067`

Total reward pool: **42 USDC** streamed across 14 days.
All contracts viewable on [Arcscan](https://testnet.arcscan.app).

---

## Design Philosophy

Most DeFi UIs default to cyberpunk neon. I went the opposite direction:

- **Palette:** Warm ivory paper, deep ink, antique brass accents
- **Typography:** Fraunces serif (editorial) + Inter (body)
- **Mood:** Quiet wealth, generous whitespace, subtle paper texture
- **Inspiration:** Private banking, Aesop product pages, Stripe Press

The goal: make yield allocation feel calm and trustworthy, not chaotic.

---

## Honest Disclaimers

- **Testnet only.** This is a prototype on Arc Testnet, not production.
- **Sponsor-funded rewards.** Yield comes from a finite USDC pool I funded as the sponsor — not from real strategy execution. The mechanics are real (Synthetix-style streaming, on-chain accrual); the source of yield is bootstrap funding.
- **Mainnet roadmap** would integrate real yield sources: Aave/Compound for lending, RWA protocols for the RWA vault, Curve/Uniswap LP for the cash vault.

The contract architecture is the same one used by production protocols. Swap the sponsor pool for a real yield strategy → ready for mainnet.

---

## What's Next

- **Risk scoring** per vault (audit status, TVL caps, smart-contract maturity)
- **Multi-vault diversification** — split allocation 50/30/20 across strategies
- **Auto-compound** — periodic rebalance keeps user always in the highest-APY vault
- **CCTP integration** — cross-chain rebalancing via Circle's bridge
- **Real yield sources** when Arc mainnet protocols are live (Aave-style lending, Pendle-style RWA, Curve-style cash)

---

## Try It

1. Visit https://arc-yield-agent.vercel.app
2. Connect MetaMask/Rabby
3. Add Arc Testnet (auto-prompt)
4. Mint 1,000 MockUSDC (testnet only)
5. Click "Allocate idle" → deposits into best-APY vault
6. Wait a bit, then check the vault card — your "earned" pending rewards will tick up in real time
7. Click `claim()` (via contract directly) to harvest

Feedback welcome. Built by [@0xdungki](https://twitter.com/0xdungki).

---

## Open Questions for Arc Builders

- What yield sources would you most want to see when Arc mainnet launches? (Aave-style? Curve-style? RWA?)
- Should vault selection support multi-vault diversification (e.g., 50% RWA + 50% Lending)?
- Interest in a DAO governance layer for vault whitelisting + sponsor approval?
- Anyone working on Arc-native lending or RWA primitives I should know about?

Drop thoughts below 👇
