const { ethers } = require("hardhat");

const parseUSDC = (value) => ethers.parseUnits(value, 6);
const formatUSDC = (value) => ethers.formatUnits(value, 6);

async function deployDemo() {
  const [agent] = await ethers.getSigners();
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const YieldVault = await ethers.getContractFactory("YieldVault");

  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const vaultConfigs = [
    ["Arc Base Cash Vault", "arcCASH", "Low-risk cash management", 430],
    ["Arc DeFi Lending Vault", "arcLEND", "Blue-chip lending markets", 720],
    ["Arc RWA Treasury Vault", "arcRWA", "Tokenized treasury yield", 960],
  ];

  const vaults = [];
  for (const cfg of vaultConfigs) {
    const vault = await YieldVault.deploy(usdc.target, ...cfg);
    await vault.waitForDeployment();
    vaults.push(vault);
  }

  await usdc.mint(agent.address, parseUSDC("1000"));
  return { agent, usdc, vaults };
}

async function scanVaults(vaults) {
  const rows = [];
  for (const vault of vaults) {
    rows.push({
      address: vault.target,
      name: await vault.name(),
      label: await vault.strategyLabel(),
      apyBps: Number(await vault.getAPY()),
    });
  }
  rows.sort((a, b) => b.apyBps - a.apyBps);
  return rows;
}

async function rebalanceToBest({ agent, usdc, vaults, amount }) {
  const ranked = await scanVaults(vaults);
  const best = vaults.find((vault) => vault.target === ranked[0].address);

  for (const vault of vaults) {
    const shares = await vault.balanceOf(agent.address);
    if (shares > 0n && vault.target !== best.target) {
      console.log(`Withdrawing ${formatUSDC(shares)} USDC from ${await vault.name()}`);
      await (await vault.withdraw(shares)).wait();
    }
  }

  const idle = await usdc.balanceOf(agent.address);
  const depositAmount = amount ?? idle;
  if (depositAmount > 0n) {
    console.log(`Depositing ${formatUSDC(depositAmount)} USDC into ${ranked[0].name} (${ranked[0].apyBps / 100}% APY)`);
    await (await usdc.approve(best.target, depositAmount)).wait();
    await (await best.deposit(depositAmount)).wait();
  }

  return ranked[0];
}

async function main() {
  console.log("Arc Stablecoin Yield Agent - local MVP\n");
  const ctx = await deployDemo();

  console.log(`Agent wallet: ${ctx.agent.address}`);
  console.log(`Mock USDC:    ${ctx.usdc.target}`);
  console.log(`Start cash:   ${formatUSDC(await ctx.usdc.balanceOf(ctx.agent.address))} mUSDC\n`);

  const ranked = await scanVaults(ctx.vaults);
  console.log("Vault scan:");
  for (const row of ranked) {
    console.log(`- ${row.name}: ${row.apyBps / 100}% APY | ${row.label} | ${row.address}`);
  }

  const best = await rebalanceToBest({ ...ctx, amount: parseUSDC("500") });
  console.log(`\nDecision: selected ${best.name} because it has the highest APY.`);

  console.log("\nBalances after rebalance:");
  for (const vault of ctx.vaults) {
    console.log(`- ${await vault.name()}: ${formatUSDC(await vault.balanceOf(ctx.agent.address))} shares`);
  }
  console.log(`- Idle wallet USDC: ${formatUSDC(await ctx.usdc.balanceOf(ctx.agent.address))}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { deployDemo, scanVaults, rebalanceToBest };
