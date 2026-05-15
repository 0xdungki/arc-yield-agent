// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title YieldVault
/// @notice Mock stablecoin vault for the Arc Stablecoin Yield Agent MVP.
/// It accepts mock USDC deposits and mints vault shares 1:1. APY is a dummy
/// value used by the off-chain AI/agent script to choose the best strategy.
contract YieldVault is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    address public owner;
    uint256 private apyBps;
    string public strategyLabel;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event ApyUpdated(uint256 oldApyBps, uint256 newApyBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        string memory strategyLabel_,
        uint256 apyBps_
    ) ERC20(name_, symbol_) {
        require(address(asset_) != address(0), "ASSET_ZERO");
        asset = asset_;
        owner = msg.sender;
        strategyLabel = strategyLabel_;
        apyBps = apyBps_;
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        asset.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        _burn(msg.sender, amount);
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function setAPY(uint256 newApyBps) external onlyOwner {
        uint256 old = apyBps;
        apyBps = newApyBps;
        emit ApyUpdated(old, newApyBps);
    }

    function getAPY() external view returns (uint256) {
        return apyBps;
    }
}
