// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StreamingYieldVault
/// @notice Real yield distribution via Synthetix-style rewards streaming.
/// @dev Yield comes from owner-funded reward pool, distributed pro-rata over
///      a fixed duration. APY is calculated from actual on-chain reward rate
///      and current TVL — no hardcoded values.
///
/// Mechanics:
/// 1. Owner calls notifyRewardAmount(amount) which streams `amount` USDC
///    over `rewardsDuration` seconds (default 7 days).
/// 2. Users deposit USDC, receive shares 1:1, and earn pro-rata rewards.
/// 3. APY = (rewardRate * SECONDS_PER_YEAR / totalSupply) * 10000 (basis points)
/// 4. Users call claim() anytime to harvest accrued rewards.
/// 5. Withdraw burns shares + returns principal + auto-claims pending rewards.
contract StreamingYieldVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant BPS_DENOMINATOR = 10000;

    IERC20 public immutable asset;
    address public owner;
    string public strategyLabel;

    // Synthetix-style rewards state
    uint256 public rewardsDuration = 7 days;
    uint256 public periodFinish;
    uint256 public rewardRate; // tokens per second
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount, uint256 newRate, uint256 periodFinish);
    event RewardsDurationUpdated(uint256 newDuration);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        string memory strategyLabel_
    ) ERC20(name_, symbol_) {
        require(address(asset_) != address(0), "ASSET_ZERO");
        asset = asset_;
        owner = msg.sender;
        strategyLabel = strategyLabel_;
    }

    /* ============================================================
       View functions
       ============================================================ */

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / totalSupply());
    }

    function earned(address account) public view returns (uint256) {
        return (balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18)
            + rewards[account];
    }

    /// @notice Real APY in basis points, calculated from current reward rate + TVL
    /// @dev Returns 0 if no rewards active or no deposits. APY = (rewardRate * 365d / TVL) in bps
    function getAPY() external view returns (uint256) {
        if (totalSupply() == 0 || block.timestamp >= periodFinish || rewardRate == 0) {
            return 0;
        }
        // APY = (yearly_rewards / TVL) * BPS = (rewardRate * SECONDS_PER_YEAR * BPS) / TVL
        return (rewardRate * SECONDS_PER_YEAR * BPS_DENOMINATOR) / totalSupply();
    }

    function getTotalRewardsRemaining() external view returns (uint256) {
        if (block.timestamp >= periodFinish) return 0;
        return rewardRate * (periodFinish - block.timestamp);
    }

    /* ============================================================
       User actions
       ============================================================ */

    function deposit(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "ZERO_AMOUNT");
        asset.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "ZERO_AMOUNT");
        _burn(msg.sender, amount);
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
        // Auto-claim pending rewards on withdraw
        _claim(msg.sender);
    }

    function claim() external nonReentrant updateReward(msg.sender) {
        _claim(msg.sender);
    }

    function _claim(address account) internal {
        uint256 reward = rewards[account];
        if (reward > 0) {
            rewards[account] = 0;
            asset.safeTransfer(account, reward);
            emit RewardClaimed(account, reward);
        }
    }

    /* ============================================================
       Owner / sponsor actions
       ============================================================ */

    /// @notice Fund the reward pool — streams `amount` USDC over `rewardsDuration`
    /// @dev Caller must approve `amount` USDC to this contract first
    function notifyRewardAmount(uint256 amount) external onlyOwner updateReward(address(0)) {
        // Pull rewards from sponsor
        asset.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        // Sanity: contract must have enough balance to cover rewards + user principal
        // (we pulled `amount` above, so balance includes it)
        require(rewardRate > 0, "REWARD_RATE_ZERO");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;

        emit RewardAdded(amount, rewardRate, periodFinish);
    }

    function setRewardsDuration(uint256 newDuration) external onlyOwner {
        require(block.timestamp >= periodFinish, "PERIOD_ACTIVE");
        require(newDuration > 0, "ZERO_DURATION");
        rewardsDuration = newDuration;
        emit RewardsDurationUpdated(newDuration);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDR");
        owner = newOwner;
    }
}
