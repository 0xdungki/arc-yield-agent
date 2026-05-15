// Deploy StreamingYieldVault contracts + fund reward pools on Arc Testnet
// Usage: npx hardhat run scripts/deploy-streaming.js --network arcTestnet
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "USDC");

  // Existing MockUSDC (deployed May 12)
  const USDC_ADDR = "0xfd483B685d9f291606b9f70511E13436c091274E";
  console.log("\nUsing existing MockUSDC:", USDC_ADDR);

  const usdc = await hre.ethers.getContractAt("MockUSDC", USDC_ADDR);
  const decimals = await usdc.decimals();
  const dec = Number(decimals);
  console.log("USDC decimals:", dec);

  const usdcBal = await usdc.balanceOf(deployer.address);
  console.log("Deployer USDC:", hre.ethers.formatUnits(usdcBal, dec));

  // Vault configurations: name, symbol, strategy, reward amount in USDC
  // 14 days duration → larger rate, healthier APY display
  // Total: 42 USDC across 3 vaults (deployer has 500 mock USDC)
  const vaultConfigs = [
    { name: "Arc Cash Vault",    symbol: "acvUSDC", label: "Cash Reserve",      reward: "7.0",  duration: 14 },
    { name: "Arc Lending Vault", symbol: "alvUSDC", label: "Lending Markets",   reward: "14.0", duration: 14 },
    { name: "Arc RWA Vault",     symbol: "arvUSDC", label: "Real-World Assets", reward: "21.0", duration: 14 },
  ];

  const totalReward = vaultConfigs.reduce((s, v) => s + parseFloat(v.reward), 0);
  console.log(`\nTotal reward pool: ${totalReward} USDC across 3 vaults`);

  if (parseFloat(hre.ethers.formatUnits(usdcBal, dec)) < totalReward) {
    console.log("⚠️  Not enough USDC for full funding. Will deploy + fund partially.");
  }

  const StreamingYieldVault = await hre.ethers.getContractFactory("StreamingYieldVault");
  const deployedVaults = [];

  for (const cfg of vaultConfigs) {
    console.log(`\n→ Deploying ${cfg.name}...`);
    const vault = await StreamingYieldVault.deploy(USDC_ADDR, cfg.name, cfg.symbol, cfg.label);
    await vault.waitForDeployment();
    const addr = await vault.getAddress();
    console.log(`  ✓ Deployed: ${addr}`);

    // Set rewards duration based on config
    const durSec = cfg.duration * 24 * 60 * 60;
    console.log(`  → Setting ${cfg.duration}-day rewards duration...`);
    const setDur = await vault.setRewardsDuration(durSec);
    await setDur.wait();
    console.log(`  ✓ Duration set`);

    // Approve + fund reward pool
    const rewardAmount = hre.ethers.parseUnits(cfg.reward, dec);
    console.log(`  → Approving ${cfg.reward} USDC for reward pool...`);
    const approve = await usdc.approve(addr, rewardAmount);
    await approve.wait();

    console.log(`  → Calling notifyRewardAmount(${cfg.reward} USDC)...`);
    const notify = await vault.notifyRewardAmount(rewardAmount);
    await notify.wait();

    // Read back state
    const apy = await vault.getAPY();
    const rate = await vault.rewardRate();
    const periodFinish = await vault.periodFinish();
    console.log(`  ✓ Rewards active`);
    console.log(`    rewardRate: ${rate.toString()} (USDC wei/sec)`);
    console.log(`    periodFinish: ${new Date(Number(periodFinish) * 1000).toISOString()}`);
    console.log(`    APY (with 0 TVL): ${apy.toString()} bps`);

    deployedVaults.push({ ...cfg, address: addr });
  }

  // Print summary for frontend update
  console.log("\n\n=== DEPLOYMENT SUMMARY ===");
  console.log("Update web/app.js CONTRACTS.vaults to:");
  console.log(JSON.stringify(deployedVaults.map((v) => v.address), null, 2));
  console.log("\nFull config:");
  deployedVaults.forEach((v) => console.log(`  ${v.label.padEnd(20)} ${v.address}`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
