require("dotenv").config();
const { ethers } = require("hardhat");

const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

const vaultAbi = [
  "function name() view returns (string)",
  "function strategyLabel() view returns (string)",
  "function getAPY() view returns (uint256)",
  "function asset() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
];

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env`);
  return process.env[name];
}

async function main() {
  const [agent] = await ethers.getSigners();
  const provider = ethers.provider;
  const usdcAddress = requireEnv("USDC_ADDRESS");
  const vaultAddresses = requireEnv("VAULTS").split(",").map((x) => x.trim()).filter(Boolean);

  const usdc = new ethers.Contract(usdcAddress, erc20Abi, provider);
  const decimals = await usdc.decimals();
  const nativeBalance = await provider.getBalance(agent.address);
  const idleUsdc = await usdc.balanceOf(agent.address);

  console.log("Arc Stablecoin Yield Agent - Status");
  console.log(`Agent:        ${agent.address}`);
  console.log(`Native gas:   ${ethers.formatEther(nativeBalance)} USDC`);
  console.log(`MockUSDC:     ${usdcAddress}`);
  console.log(`Idle MockUSD: ${ethers.formatUnits(idleUsdc, decimals)}`);
  console.log("");
  console.log("Vaults:");

  const rows = [];
  for (const address of vaultAddresses) {
    const vault = new ethers.Contract(address, vaultAbi, provider);
    const [name, label, apyBps, shares, asset] = await Promise.all([
      vault.name(),
      vault.strategyLabel(),
      vault.getAPY(),
      vault.balanceOf(agent.address),
      vault.asset(),
    ]);
    rows.push({ address, name, label, apyBps: Number(apyBps), shares, asset });
  }

  rows.sort((a, b) => b.apyBps - a.apyBps);
  for (const row of rows) {
    const marker = row.shares > 0n ? "*" : "-";
    console.log(`${marker} ${row.name}`);
    console.log(`  APY:    ${row.apyBps / 100}%`);
    console.log(`  Shares: ${ethers.formatUnits(row.shares, decimals)}`);
    console.log(`  Label:  ${row.label}`);
    console.log(`  Addr:   ${row.address}`);
  }

  const best = rows[0];
  console.log("");
  console.log(`Recommendation: ${best.name} (${best.apyBps / 100}% APY)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
