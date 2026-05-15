import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.16.0/+esm";

const ARC = {
  chainId: 5042002,
  chainHex: "0x4CEF52",
  chainName: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
};

const CONTRACTS = {
  mockUsdc: "0xfd483B685d9f291606b9f70511E13436c091274E",
  // StreamingYieldVault contracts (real on-chain reward streaming)
  // Deployed May 16, 2026 — 14-day reward periods, funded from deployer pool
  vaults: [
    "0xd75451A8934704e3229692Cb04D42C494Dfc87C7", // Cash Reserve   (7 USDC pool)
    "0x63Ec96081521DB57ADce4870B5a478b2c4dC726b", // Lending Markets (14 USDC pool)
    "0xc9a089B6D0327d0bFA0429156014F6DD209d199C", // Real-World Assets (21 USDC pool)
  ],
};

const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
];
const vaultAbi = [
  "function name() view returns (string)",
  "function strategyLabel() view returns (string)",
  "function getAPY() view returns (uint256)",
  "function asset() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function rewardsDuration() view returns (uint256)",
  "function getTotalRewardsRemaining() view returns (uint256)",
  "function earned(address) view returns (uint256)",
  "function deposit(uint256)",
  "function withdraw(uint256)",
  "function claim()",
];

const $ = (id) => document.getElementById(id);
const ui = {
  connectBtn: $("connectBtn"),
  switchBtn: $("switchBtn"),
  refreshBtn: $("refreshBtn"),
  mintBtn: $("mintBtn"),
  rebalanceBtn: $("rebalanceBtn"),
  networkPill: $("networkPill"),
  netDot: $("netDot"),
  walletAddress: $("walletAddress"),
  recommendation: $("recommendation"),
  bestApy: $("bestApy"),
  activeStrategies: $("activeStrategies"),
  recNote: $("recNote"),
  idleUsdc: $("idleUsdc"),
  totalShares: $("totalShares"),
  nativeGas: $("nativeGas"),
  vaultList: $("vaultList"),
  contracts: $("contracts"),
  log: $("log"),
  toast: $("toast"),
  shareBtn: $("shareBtn"),
};

let readProvider = new ethers.JsonRpcProvider(ARC.rpcUrl, ARC.chainId);
let browserProvider;
let signer;
let account;
let decimals = 6;
let latestVaults = [];

/* ============================================================
   Helpers
   ============================================================ */
function logLine(message) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const line = `${time}  ·  ${message}`;
  ui.log.textContent = `${line}\n${ui.log.textContent}`.slice(0, 6000);
}

function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "not connected";
}

function fmtToken(value) {
  return Number(ethers.formatUnits(value ?? 0n, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function fmtCompact(value, suffix = "") {
  const n = typeof value === "bigint" ? Number(ethers.formatUnits(value, decimals)) : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function setBusy(isBusy) {
  [ui.refreshBtn, ui.mintBtn, ui.rebalanceBtn, ui.connectBtn, ui.switchBtn].forEach((btn) => {
    if (btn) btn.disabled = isBusy;
  });
}

let toastTimer;
function toast(message, kind = "default") {
  ui.toast.textContent = message;
  ui.toast.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.className = "toast";
  }, 4000);
}

/* ============================================================
   Wallet & network
   ============================================================ */
async function getActiveProvider() {
  if (signer) return signer.provider;
  return readProvider;
}

async function getReadAddress() {
  return account || "0x86563098801D6Fc60a4250911d2037CEc2172067";
}

async function switchArc() {
  if (!window.ethereum) throw new Error("No wallet detected. Install MetaMask or Rabby.");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC.chainHex }] });
  } catch (err) {
    if (err.code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: ARC.chainHex,
        chainName: ARC.chainName,
        nativeCurrency: ARC.nativeCurrency,
        rpcUrls: [ARC.rpcUrl],
        blockExplorerUrls: [ARC.explorer],
      }],
    });
  }
}

async function connect() {
  if (!window.ethereum) {
    toast("Install MetaMask or Rabby to continue.", "error");
    throw new Error("No wallet");
  }
  await switchArc();
  browserProvider = new ethers.BrowserProvider(window.ethereum);
  signer = await browserProvider.getSigner();
  account = await signer.getAddress();

  ui.walletAddress.textContent = `Connected · ${short(account)}`;
  ui.walletAddress.title = account;
  ui.networkPill.textContent = `Arc Testnet · ${short(account)}`;
  ui.netDot.classList.add("connected");
  ui.connectBtn.querySelector(".btn-label").textContent = "Wallet connected";
  ui.connectBtn.querySelector(".btn-arrow").textContent = "✓";

  logLine(`Connected ${short(account)}`);
  toast("Wallet connected.", "success");
  await refresh();
}

/* ============================================================
   Data load
   ============================================================ */
const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const BPS_DENOMINATOR = 10000n;

async function loadVaults(provider, address) {
  const rows = [];
  for (const vaultAddress of CONTRACTS.vaults) {
    try {
      const vault = new ethers.Contract(vaultAddress, vaultAbi, provider);
      const [name, label, apyBps, shares, asset, totalSupply, rewardRate, periodFinish, rewardsRemaining, earned] = await Promise.all([
        vault.name(),
        vault.strategyLabel(),
        vault.getAPY(),
        vault.balanceOf(address),
        vault.asset(),
        vault.totalSupply(),
        vault.rewardRate(),
        vault.periodFinish(),
        vault.getTotalRewardsRemaining(),
        address && address !== ethers.ZeroAddress ? vault.earned(address) : Promise.resolve(0n),
      ]);
      
      // Calculate projected APY for a hypothetical 100 USDC deposit
      // (helps users see what APY they'd actually get)
      const projectedTvl = totalSupply > 0n ? totalSupply : 100_000_000n; // 100 USDC in 6-decimal units
      const now = BigInt(Math.floor(Date.now() / 1000));
      const isActive = periodFinish > now && rewardRate > 0n;
      const projectedApyBps = isActive
        ? (rewardRate * SECONDS_PER_YEAR * BPS_DENOMINATOR) / projectedTvl
        : 0n;
      
      rows.push({
        address: vaultAddress,
        name,
        label,
        apyBps: Number(apyBps),
        projectedApyBps: Number(projectedApyBps),
        shares,
        asset,
        totalSupply,
        rewardRate,
        periodFinish: Number(periodFinish),
        rewardsRemaining,
        earned,
        isActive,
      });
    } catch (err) {
      logLine(`Vault ${short(vaultAddress)} read error: ${err.shortMessage || err.message}`);
    }
  }
  // Sort by projected APY (more useful than current APY when TVL is low)
  rows.sort((a, b) => b.projectedApyBps - a.projectedApyBps);
  return rows;
}

function renderVaults(vaults) {
  if (!vaults.length) {
    ui.vaultList.innerHTML = `<p class="muted">No vaults available.</p>`;
    return;
  }
  const maxApy = vaults[0]?.projectedApyBps || 1;
  ui.vaultList.innerHTML = vaults.map((v, i) => {
    // Show projected APY (real-time calculation based on rewardRate)
    const apyPct = (v.projectedApyBps / 100).toFixed(1);
    const fillPct = Math.max(8, Math.round((v.projectedApyBps / maxApy) * 100));
    
    // Reward period info
    const finishDate = v.periodFinish > 0
      ? new Date(v.periodFinish * 1000).toLocaleDateString([], { month: "short", day: "numeric" })
      : "—";
    const earnedAmount = v.earned > 0n ? `${fmtToken(v.earned)} pending` : "";
    
    return `
      <article class="vault ${i === 0 ? "best" : ""}">
        ${i === 0 ? `<span class="vault-tag">★ Allocator pick</span>` : `<span class="vault-tag">Strategy ${i + 1}</span>`}
        <div>
          <h3 class="vault-name">${v.name}</h3>
          <p class="vault-strategy">${v.label}${v.isActive ? "" : " · Pre-launch"}</p>
        </div>
        <p class="vault-rate">${apyPct}<small>% APY${v.totalSupply === 0n ? " (projected)" : ""}</small></p>
        <div class="vault-bar"><div class="vault-bar-fill" style="width:${fillPct}%"></div></div>
        <div class="vault-shares-row">
          <span>Your shares</span>
          <strong>${fmtToken(v.shares)}${earnedAmount ? ` · ${earnedAmount}` : ""}</strong>
        </div>
        <div class="vault-shares-row" style="margin-top:6px;font-size:11px;opacity:0.7">
          <span>Rewards until</span>
          <strong>${finishDate}</strong>
        </div>
        <div class="vault-addr">
          <code>${v.address}</code>
        </div>
      </article>
    `;
  }).join("");
}

function renderContracts() {
  ui.contracts.innerHTML = `
    <div><span class="muted">MockUSDC</span> <code>${CONTRACTS.mockUsdc}</code></div>
    ${CONTRACTS.vaults.map((v, i) => `<div><span class="muted">Vault ${i + 1}</span> <code>${v}</code></div>`).join("")}
    <div><span class="muted">Explorer</span> <a href="${ARC.explorer}" target="_blank" rel="noreferrer">${ARC.explorer.replace(/^https?:\/\//, "")}</a></div>
  `;
}

/* ============================================================
   Refresh
   ============================================================ */
async function refresh() {
  setBusy(true);
  try {
    const provider = await getActiveProvider();
    const address = await getReadAddress();
    const usdc = new ethers.Contract(CONTRACTS.mockUsdc, erc20Abi, provider);
    decimals = Number(await usdc.decimals());

    const [idle, gas, vaults] = await Promise.all([
      usdc.balanceOf(address),
      provider.getBalance(address),
      loadVaults(provider, address),
    ]);

    latestVaults = vaults;
    const totalShares = vaults.reduce((sum, v) => sum + v.shares, 0n);

    ui.idleUsdc.textContent = `${fmtToken(idle)} mUSDC`;
    ui.totalShares.textContent = `${fmtToken(totalShares)}`;
    ui.nativeGas.textContent = `${Number(ethers.formatEther(gas)).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`;

    if (vaults.length) {
      const best = vaults[0];
      ui.recommendation.textContent = best.name;
      ui.bestApy.textContent = `${(best.apyBps / 100).toFixed(1)}%`;
      ui.activeStrategies.textContent = vaults.length;
      ui.recNote.textContent = `Based on the latest on-chain quote, allocate idle balance to ${best.name}. ${best.label}.`;
    }

    renderVaults(vaults);
    if (!account) {
      ui.networkPill.textContent = `Arc Testnet · read-only`;
    }

    logLine(`Refreshed for ${short(address)}`);
  } catch (err) {
    logLine(`ERROR refresh: ${err.shortMessage || err.message}`);
    toast(`Refresh failed: ${err.shortMessage || err.message}`, "error");
  } finally {
    setBusy(false);
  }
}

/* ============================================================
   Mint
   ============================================================ */
async function mint() {
  try {
    if (!signer || !account) await connect();
    setBusy(true);
    const usdc = new ethers.Contract(CONTRACTS.mockUsdc, erc20Abi, signer);
    const amount = ethers.parseUnits("1000", decimals);
    logLine("Minting 1,000 mUSDC…");
    const tx = await usdc.mint(account, amount);
    logLine(`tx: ${tx.hash}`);
    toast("Mint submitted, awaiting confirmation…");
    await tx.wait();
    logLine("Mint confirmed.");
    toast("Minted 1,000 mUSDC.", "success");
    await refresh();
  } catch (err) {
    logLine(`ERROR mint: ${err.shortMessage || err.message}`);
    toast(err.shortMessage || err.message, "error");
  } finally {
    setBusy(false);
  }
}

/* ============================================================
   Rebalance / Allocate
   ============================================================ */
async function rebalance() {
  try {
    if (!signer || !account) await connect();
    setBusy(true);
    const usdc = new ethers.Contract(CONTRACTS.mockUsdc, erc20Abi, signer);
    const idle = await usdc.balanceOf(account);
    if (idle <= 0n) throw new Error("No idle mUSDC. Mint first.");
    const best = latestVaults[0] || (await loadVaults(signer.provider, account))[0];

    logLine(`Approving ${fmtToken(idle)} mUSDC → ${best.name}…`);
    toast("Approving allocation…");
    const approveTx = await usdc.approve(best.address, idle);
    logLine(`approve: ${approveTx.hash}`);
    await approveTx.wait();

    const vault = new ethers.Contract(best.address, vaultAbi, signer);
    logLine(`Depositing into ${best.name}…`);
    toast("Allocating into best vault…");
    const depositTx = await vault.deposit(idle);
    logLine(`deposit: ${depositTx.hash}`);
    await depositTx.wait();
    logLine("Allocation complete.");
    toast(`Allocated to ${best.name}.`, "success");
    await refresh();
  } catch (err) {
    logLine(`ERROR allocate: ${err.shortMessage || err.message}`);
    toast(err.shortMessage || err.message, "error");
  } finally {
    setBusy(false);
  }
}

/* ============================================================
   Share button — Twitter intent
   ============================================================ */
function setupShare() {
  if (!ui.shareBtn) return;
  const text = encodeURIComponent(
    "I just allocated stablecoins to the best on-chain APY in one click 🟫\n\nArc Yield Agent — autonomous yield allocator on @arc by @0xdungki\n\n"
  );
  const url = encodeURIComponent("https://arc-yield-agent.vercel.app");
  ui.shareBtn.href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}

/* ============================================================
   Wire up
   ============================================================ */
ui.connectBtn.addEventListener("click", () => connect().catch((err) => logLine(`ERROR connect: ${err.shortMessage || err.message}`)));
ui.switchBtn.addEventListener("click", () => switchArc().then(() => { logLine("Arc network ready."); toast("Arc Testnet selected."); }).catch((err) => { logLine(`ERROR switch: ${err.shortMessage || err.message}`); toast(err.shortMessage || err.message, "error"); }));
ui.refreshBtn.addEventListener("click", () => refresh().catch(() => {}));
ui.mintBtn.addEventListener("click", mint);
ui.rebalanceBtn.addEventListener("click", rebalance);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}

renderContracts();
setupShare();
refresh().catch(() => {});

/* Auto-refresh every 60s when tab visible */
setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, 60000);
