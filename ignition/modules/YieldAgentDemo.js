const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("YieldAgentDemo", (m) => {
  const usdc = m.contract("MockUSDC");

  const cashVault = m.contract("YieldVault", [
    usdc,
    "Arc Base Cash Vault",
    "arcCASH",
    "Low-risk cash management",
    430,
  ], { id: "CashVault" });

  const lendingVault = m.contract("YieldVault", [
    usdc,
    "Arc DeFi Lending Vault",
    "arcLEND",
    "Blue-chip lending markets",
    720,
  ], { id: "LendingVault" });

  const rwaVault = m.contract("YieldVault", [
    usdc,
    "Arc RWA Treasury Vault",
    "arcRWA",
    "Tokenized treasury yield",
    960,
  ], { id: "RwaVault" });

  return { usdc, cashVault, lendingVault, rwaVault };
});
