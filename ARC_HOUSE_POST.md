# Arc Yield Agent — Arc House Community Post

**Title:** Arc Yield Agent: Autonomous Stablecoin Allocator on Arc Testnet

**Category:** Projects & Builds

---

## Overview

I built **Arc Yield Agent** — an autonomous stablecoin allocator that scans on-chain vaults, recommends the optimal APY, and rebalances user positions with a single signature.

**Live demo:** https://arc-yield-agent.vercel.app

---

## Why Arc?

USDC as native gas is a game-changer for stablecoin products. Users pay transaction fees in the same asset they're allocating — no wrapped tokens, no bridge friction, no mental overhead.

This makes Arc perfect for yield optimization products where the entire flow (deposit, rebalance, withdraw) happens in one asset.

---

## How It Works

1. **Scan:** Agent queries 3 live vaults on Arc Testnet (Cash, Lending, RWA)
2. **Recommend:** Sorts by APY, highlights the best strategy
3. **Allocate:** User approves + deposits idle MockUSDC with one click
4. **Auto-refresh:** Vault data updates every 60s

No backend. Pure on-chain reads via ethers.js + Arc RPC.

---

## Tech Stack

- **Contracts:** Hardhat + OpenZeppelin (3 mock vaults + MockUSDC)
- **Frontend:** Vanilla JS + ethers.js (no framework bloat)
- **Design:** Editorial luxury aesthetic (anti-cyberpunk)
- **Deploy:** Vercel static hosting
- **Bundle:** 41KB total (HTML 8.5K + CSS 17K + JS 13K)

---

## Deployed Contracts (Arc Testnet)

- **MockUSDC:** `0xfd483B685d9f291606b9f70511E13436c091274E`
- **Cash Vault (4.3% APY):** `0xC2776af10e1721655747508941475C058Eb12556`
- **Lending Vault (7.2% APY):** `0x36E5d19996df30A8c3E31c7Adaa069dDC522276D`
- **RWA Vault (9.6% APY):** `0x2e02C3C3F00A10F0f1CF2E511a97F7670365002b`
- **Deployer:** `0x86563098801D6Fc60a4250911d2037CEc2172067`

All contracts verified on [Arcscan](https://testnet.arcscan.app).

---

## Design Philosophy

Most DeFi UIs default to cyberpunk neon. I went the opposite direction:

- **Palette:** Warm ivory paper, deep ink, antique brass accents
- **Typography:** Fraunces serif (editorial) + Inter (body)
- **Mood:** Quiet wealth, generous whitespace, subtle paper texture
- **Inspiration:** Private banking, Aesop product pages, Stripe Press

The goal: make yield allocation feel calm and trustworthy, not chaotic.

---

## What's Next

This is a testnet prototype. Production roadmap:

- **Risk scoring** per vault (not just APY)
- **Portfolio limits** & policy approval
- **Multi-chain support** (Arc mainnet when live)
- **CCTP integration** for cross-chain rebalancing
- **Real yield sources** (Aave, Compound, RWA protocols)

---

## Try It

1. Visit https://arc-yield-agent.vercel.app
2. Connect MetaMask/Rabby
3. Add Arc Testnet (auto-prompt)
4. Mint 1,000 MockUSDC (testnet only)
5. Click "Allocate idle" → deposits into best vault

Feedback welcome. Built by [@0xdungki](https://twitter.com/0xdungki).

---

## Open Questions for Arc Builders

- What yield sources would you want to see on Arc mainnet?
- Should the agent support multi-vault diversification (e.g., 50% RWA + 50% Lending)?
- Interest in a DAO governance layer for vault whitelisting?

Let me know in the comments 👇
