// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// TTSVestingWallet — Single-beneficiary linear vesting contract
//
// Functionally equivalent to OpenZeppelin VestingWallet v5.x (self-contained,
// no external imports required for Remix compilation).
//
// Vesting schedule
// ─────────────────
//   Nothing vests before `start`.
//   Tokens vest linearly from `start` to `start + duration`.
//   The 1-year cliff is implemented by setting start = deployTimestamp + 365 days.
//   duration = 3 years (linear release after cliff).
//   Total lockup = 4 years from deployment.
//
// Operation
// ─────────
//   1. Deploy one instance per beneficiary (Bank wallet, Remix).
//      Constructor args: beneficiaryAddress, startTimestamp, durationSeconds
//   2. (Optional but recommended) Add each contract to TTS tax-exempt list
//      via Gnosis Safe setTaxExempt(contractAddress, true).
//   3. Transfer TTS from Bank wallet to each VestingWallet contract address.
//   4. Beneficiary calls release(TTS_TOKEN) to claim vested tokens at any time.
//      Anyone may call release — tokens always go to beneficiary.
//
// TTS token: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9 (Base mainnet)
//
// Compile settings: Solidity 0.8.20 · optimizer ON (200 runs) · via IR ✓
//
// See scripts/deploy_vesting.js for constructor params.
// See outputs/vesting_setup_guide.md for full setup instructions.

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TTSVestingWallet {
    // ── Immutable state ───────────────────────────────────────────────────────
    address public immutable beneficiary;
    uint64  public immutable start;      // cliff end / vesting begin (unix timestamp)
    uint64  public immutable duration;   // linear release period (seconds after start)

    // ── Released tracking ─────────────────────────────────────────────────────
    mapping(address => uint256) private _released;

    // ── Events ────────────────────────────────────────────────────────────────
    event ERC20Released(address indexed token, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address beneficiaryAddress,
        uint64  startTimestamp,
        uint64  durationSeconds
    ) {
        require(beneficiaryAddress != address(0), "VestingWallet: zero address");
        require(durationSeconds > 0,              "VestingWallet: zero duration");
        beneficiary = beneficiaryAddress;
        start       = startTimestamp;
        duration    = durationSeconds;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /// @notice Tokens of `token` already released to beneficiary.
    function released(address token) public view returns (uint256) {
        return _released[token];
    }

    /// @notice Tokens of `token` that are vested but not yet released.
    function releasable(address token) public view returns (uint256) {
        return vestedAmount(token, uint64(block.timestamp)) - _released[token];
    }

    /// @notice Total tokens of `token` vested at `timestamp` (released + unreleased).
    function vestedAmount(address token, uint64 timestamp) public view returns (uint256) {
        uint256 totalAllocation = IERC20(token).balanceOf(address(this)) + _released[token];
        return _vestingSchedule(totalAllocation, timestamp);
    }

    // ── Release ───────────────────────────────────────────────────────────────

    /// @notice Release all currently vested tokens of `token` to beneficiary.
    ///         Anyone may call; tokens always go to beneficiary.
    function release(address token) external {
        uint256 amount = releasable(token);
        require(amount > 0, "VestingWallet: nothing releasable");
        _released[token] += amount;
        emit ERC20Released(token, amount);
        bool ok = IERC20(token).transfer(beneficiary, amount);
        require(ok, "VestingWallet: transfer failed");
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /// @dev Linear schedule: 0 before start, proportional during, full after end.
    function _vestingSchedule(uint256 totalAllocation, uint64 timestamp)
        internal view returns (uint256)
    {
        if (timestamp < start)              return 0;
        if (timestamp >= start + duration)  return totalAllocation;
        return (totalAllocation * (timestamp - start)) / duration;
    }
}
