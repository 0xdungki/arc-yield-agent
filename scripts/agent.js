require("dotenv").config();
const { ethers } = require("hardhat");

const vaultAbi = [
  "function name() view returns (string)",
  "function strategyLabel() view returns (string)",
  "function getAPY() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function deposit(uint256)",
  "function withdraw(uint256)",
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env`);
  return process.env[name];
}

function parseVaults(raw) {
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const usdc = new ethers.Contract(requireEnv("USDC_ADDRESS"), erc20Abi, signer);
  const vaultAddresses = parseVaults(requireEnv("VAULTS"));
  const amountRaw = process.env.REBALANCE_AMOUNT || "0";
  const decimals = await usdc.decimals();
  const rebalanceAmount = ethers.parseUnits(amountRaw, decimals);

  console.log("Arc Stablecoin Yield Agent");
  console.log(`Agent: ${signer.address}`);
  console.log(`Mode: ${process.env.EXECUTE === "true" ? "EXECUTE" : "DRY_RUN"}`);

  const vaults = [];
  for (const address of vaultAddresses) {
    const vault = new ethers.Contract(address, vaultAbi, signer);
    vaults.push({
      contract: vault,
      address,
      name: await vault.name(),
      label: await vault.strategyLabel(),
      apyBps: Number(await vault.getAPY()),
      shares: await vault.balanceOf(signer.address),
    });
  }

  vaults.sort((a, b) => b.apyBps - a.apyBps);
  console.log("\nVault scan:");
  for (const v of vaults) {
    console.log(`- ${v.name}: ${v.apyBps / 100}% APY | shares=${ethers.formatUnits(v.shares, decimals)} | ${v.address}`);
  }

  const best = vaults[0];
  console.log(`\nRecommendation: ${best.name} (${best.apyBps / 100}% APY)`);

  if (process.env.EXECUTE !== "true") {
    console.log("Dry-run only. Set EXECUTE=true to withdraw/deposit.");
    return;
  }

  for (const v of vaults) {
    if (v.address.toLowerCase() !== best.address.toLowerCase() && v.shares > 0n) {
      console.log(`Withdrawing ${ethers.formatUnits(v.shares, decimals)} from ${v.name}`);
      await (await v.contract.withdraw(v.shares)).wait();
    }
  }

  const idle = await usdc.balanceOf(signer.address);
  const amount = rebalanceAmount > 0n ? rebalanceAmount : idle;
  if (amount > 0n) {
    console.log(`Depositing ${ethers.formatUnits(amount, decimals)} into ${best.name}`);
    await (await usdc.approve(best.address, amount)).wait();
    await (await best.contract.deposit(amount)).wait();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
