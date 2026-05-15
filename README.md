# Arc Stablecoin Yield Agent

Prototype untuk ide **Arc Stablecoin Yield Agent**: agent yang scan beberapa vault/yield strategy dummy di Arc testnet, memilih APY terbaik, lalu melakukan rebalance mock USDC ke vault terbaik.

## Current Arc Testnet Deployment

Deployer / agent wallet:

```text
0x86563098801D6Fc60a4250911d2037CEc2172067
```

Contracts:

```text
MockUSDC    0xfd483B685d9f291606b9f70511E13436c091274E
CashVault   0xC2776af10e1721655747508941475C058Eb12556  APY 4.3%
LendingVault 0x36E5d19996df30A8c3E31c7Adaa069dDC522276D APY 7.2%
RwaVault    0x2e02C3C3F00A10F0f1CF2E511a97F7670365002b  APY 9.6%
```

Latest verified demo state:

```text
Idle MockUSDC: 500
RWA vault shares: 500
Cash vault shares: 0
Lending vault shares: 0
```

## Isi Prototype

- `contracts/MockUSDC.sol` — ERC20 mock USDC dengan 6 decimals.
- `contracts/YieldVault.sol` — vault dummy yang menerima mock USDC, mint share 1:1, dan expose `getAPY()`.
- `scripts/demo-local.js` — demo full lokal: deploy mock USDC + 3 vault, mint USDC, scan APY, rebalance.
- `scripts/agent.js` — agent runner untuk kontrak Arc testnet; default dry-run, execute kalau `EXECUTE=true`.
- `scripts/status.js` — cek status on-chain: native gas, idle MockUSDC, vault APY, dan shares.
- `web/` — frontend browser publik: read status, connect wallet, mint MockUSDC, dan deposit idle token ke vault APY terbaik.
- `ignition/modules/YieldAgentDemo.js` — deploy module untuk Arc testnet via Hardhat Ignition.
- `test/YieldVault.test.js` — test deposit, withdraw, APY update, dan rebalance flow.

## Install

```bash
npm install
```

## Test Lokal

```bash
npm test
```

## Run Demo Lokal

```bash
npm run demo
```

Expected flow:

1. Deploy mock USDC dan 3 vault lokal.
2. Mint 1000 mUSDC ke agent wallet lokal.
3. Scan vault APY:
   - Arc Base Cash Vault
   - Arc DeFi Lending Vault
   - Arc RWA Treasury Vault
4. Pilih APY tertinggi.
5. Deposit 500 mUSDC ke vault terbaik.
6. Print balances setelah rebalance.

## Arc Testnet Commands

Copy `.env.example` to `.env` and set `PRIVATE_KEY`.

```bash
cp .env.example .env
```

Deploy fresh contracts:

```bash
npm run deploy
```

Check deployed on-chain state:

```bash
npm run status
```

Run frontend locally:

```bash
npm run web
```

Public web demo currently exposes `web/` through Cloudflare Quick Tunnel. It reads live Arc testnet contracts and lets users connect a wallet, mint public MockUSDC, and deposit idle MockUSDC into the best APY vault.

Dry-run scan/recommendation:

```bash
npm run agent
```

Execute rebalance:

```bash
REBALANCE_AMOUNT=500 EXECUTE=true npm run agent
```

## Agent Logic

1. Read vault list from `VAULTS`.
2. Query `getAPY()` and current wallet shares.
3. Sort vaults by APY descending.
4. Recommend the highest APY vault.
5. If `EXECUTE=true`, withdraw shares from non-best vaults and deposit idle MockUSDC into the best vault.

## Pitch Singkat

Stablecoin user butuh agent yang bisa mengelola idle USDC secara otomatis. Prototype ini menunjukkan flow paling simpel: agent membaca yield strategy, memilih risk/yield terbaik, lalu memindahkan dana ke vault paling optimal. Versi produksi bisa ditambah risk scoring, bridge/swap via Arc App Kit, policy approval, and portfolio limits.

## Catatan Keamanan

Ini mock prototype, bukan production vault. Jangan pakai private key mainnet. Vault belum menghitung real yield; APY hanya dummy metadata untuk decision engine.
