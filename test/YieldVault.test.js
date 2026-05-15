const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Arc Stablecoin Yield Agent contracts", function () {
  let owner, user;
  let usdc, lowVault, highVault;

  const parseUSDC = (value) => ethers.parseUnits(value, 6);

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const YieldVault = await ethers.getContractFactory("YieldVault");
    lowVault = await YieldVault.deploy(usdc.target, "Arc Aave USDC Vault", "aUSDC-A", "Aave style stable yield", 520);
    highVault = await YieldVault.deploy(usdc.target, "Arc RWA USDC Vault", "aUSDC-R", "RWA treasury bills", 910);

    await usdc.mint(user.address, parseUSDC("1000"));
  });

  it("deploys mock USDC and vault metadata", async function () {
    expect(await usdc.decimals()).to.equal(6);
    expect(await highVault.owner()).to.equal(owner.address);
    expect(await highVault.asset()).to.equal(usdc.target);
    expect(await highVault.strategyLabel()).to.equal("RWA treasury bills");
    expect(await highVault.getAPY()).to.equal(910);
  });

  it("allows USDC deposit and withdrawal", async function () {
    const depositAmount = parseUSDC("250");

    await usdc.connect(user).approve(lowVault.target, depositAmount);
    await lowVault.connect(user).deposit(depositAmount);

    expect(await lowVault.balanceOf(user.address)).to.equal(depositAmount);
    expect(await usdc.balanceOf(lowVault.target)).to.equal(depositAmount);

    await lowVault.connect(user).withdraw(parseUSDC("100"));
    expect(await lowVault.balanceOf(user.address)).to.equal(parseUSDC("150"));
    expect(await usdc.balanceOf(user.address)).to.equal(parseUSDC("850"));
  });

  it("lets the agent rebalance from a lower APY vault to the highest APY vault", async function () {
    const amount = parseUSDC("400");

    await usdc.connect(user).approve(lowVault.target, amount);
    await lowVault.connect(user).deposit(amount);

    expect(await lowVault.getAPY()).to.be.lessThan(await highVault.getAPY());

    await lowVault.connect(user).withdraw(amount);
    await usdc.connect(user).approve(highVault.target, amount);
    await highVault.connect(user).deposit(amount);

    expect(await lowVault.balanceOf(user.address)).to.equal(0n);
    expect(await highVault.balanceOf(user.address)).to.equal(amount);
  });

  it("allows APY updates so the off-chain agent can react", async function () {
    await highVault.setAPY(1200);
    expect(await highVault.getAPY()).to.equal(1200);
    await expect(highVault.connect(user).setAPY(100)).to.be.revertedWith("ONLY_OWNER");
  });
});
