// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * @title TTSStaking (canonical / final)
 * @notice UUPS-upgradeable staking for Temptation Token ($TTS) on Base.
 *
 * DESIGN (Jim-confirmed, 2026-07-19):
 *  1. FRESH contract — not an upgrade of the mis-initialized proxy
 *     0xaA12B889…. The 10B TTS reward pool is migrated in as reward surplus.
 *  2. LOCK MODEL — principal is withdrawable ANYTIME (`unstake`, and the
 *     always-open `emergencyWithdraw`). Only the VOTE MULTIPLIER is time-gated:
 *     a position must be >= MULTIPLIER_ELIGIBILITY (7 days) old before
 *     `getStakingTier` reports a tier. Any principal INCREASE resets that clock,
 *     which stops flash-stake-vote AND flash-top-up-to-upgrade-tier gaming
 *     without ever locking user funds.
 *  3. TIER THRESHOLDS — manual, admin-set TTS amounts, editable by MANAGER_ROLE
 *     with a strict-ascending + max-deviation sanity guard.
 *  4. REWARD ECONOMICS — the funded surplus (== balance − totalStaked) is the
 *     rewards budget. APRs by amount-tier: Bronze 8% / Silver 12% / Gold 18% /
 *     Diamond 32% / VIP 45%. Rewards are paid STRICTLY from surplus, so a reward
 *     bug can never touch principal (INV: balance >= totalStaked, always).
 *  5. UPGRADE AUTHORITY — UPGRADER_ROLE is the Gnosis Safe + timelock, NEVER the
 *     Bank EOA. DEFAULT_ADMIN_ROLE / MANAGER_ROLE are the Safe.
 *
 * INTEGRATION SEAM (must not change): TTSVotingV3d calls
 *   getStakingTier(address) returns (uint256 tier 0..4)
 * inside a try/catch — a revert makes voting fall back to 1x multiplier and the
 * unstaked vote cap. We deliberately revert while a position is inside its
 * 7-day eligibility window, so an ineligible staker votes exactly like an
 * unstaked user until the multiplier activates.
 */
contract TTSStaking is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // ── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant MANAGER_ROLE  = keccak256("MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant MULTIPLIER_ELIGIBILITY = 7 days;       // 604800
    uint256 public constant SECONDS_PER_YEAR       = 365 days;     // 31_536_000
    uint256 public constant BPS_DENOM              = 10_000;
    uint256 public constant MAX_THRESHOLD_DEVIATION = 4;           // ≤4× change per edit

    // Published launch APRs (basis points). These are the DEFAULTS set at
    // initialize; the live rates live in storage (aprBronze..aprVip) so the Safe
    // can throttle emissions to protect the reward-pool runway WITHOUT a contract
    // upgrade. See setAprBps + the Gate-E depletion model.
    uint16 public constant DEFAULT_APR_BRONZE  =  800; //  8%
    uint16 public constant DEFAULT_APR_SILVER  = 1200; // 12%
    uint16 public constant DEFAULT_APR_GOLD    = 1800; // 18%
    uint16 public constant DEFAULT_APR_DIAMOND = 3200; // 32%
    uint16 public constant DEFAULT_APR_VIP     = 4500; // 45%
    uint16 public constant MAX_APR_BPS         = 20_000; // 200% hard ceiling (sanity)

    // e18-scaled vote multipliers (for getMultiplier / UI). getStakingTier tiers
    // map: 0→1.1x 1→1.25x 2→1.5x 3→2x 4→3x (V3d applies these on-chain).
    uint256 public constant MULTIPLIER_BASE    = 1e18;    // 1.00x (unstaked/ineligible)
    uint256 public constant MULTIPLIER_BRONZE  = 1.10e18;
    uint256 public constant MULTIPLIER_SILVER  = 1.25e18;
    uint256 public constant MULTIPLIER_GOLD    = 1.50e18;
    uint256 public constant MULTIPLIER_DIAMOND = 2e18;
    uint256 public constant MULTIPLIER_VIP     = 3e18;

    // ── Per-user position ─────────────────────────────────────────────────────
    struct StakeInfo {
        uint256 amount;      // credited principal (18-dec) — segregated from rewards
        uint256 eligibleAt;  // multiplier active once block.timestamp >= this
        uint256 accrued;     // settled-but-unclaimed rewards
        uint256 lastAccrual; // last time `accrued` was checkpointed
        uint16  aprBps;      // cached APR for the current amount-tier
    }

    // ── Storage ───────────────────────────────────────────────────────────────
    IERC20Upgradeable public ttsToken;   // the ONLY token this contract custodies
    uint256 public totalStaked;          // Σ of all users' principal
    uint256 public totalRewardsPaid;     // lifetime rewards claimed (accounting)

    // Manual, admin-set TTS thresholds (strictly ascending). 0 == "not set" ⇒
    // getStakingTier reverts ⇒ 1x for everyone (safe default).
    uint256 public tierThresholdBronze;
    uint256 public tierThresholdSilver;
    uint256 public tierThresholdGold;
    uint256 public tierThresholdDiamond;
    uint256 public tierThresholdVIP;

    // Live, governance-adjustable per-tier APRs (bps). Default to the published
    // values at initialize. Packed into a single slot.
    uint16 public aprBronze;
    uint16 public aprSilver;
    uint16 public aprGold;
    uint16 public aprDiamond;
    uint16 public aprVip;

    mapping(address => StakeInfo) private _stakes;

    uint256[43] private __gap; // reserve for future upgrades

    // ── Events ────────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount, uint256 newPrincipal, uint256 eligibleAt);
    event Unstaked(address indexed user, uint256 amount, uint256 remaining);
    event RewardsClaimed(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 principal);
    event TierThresholdsUpdated(uint256 bronze, uint256 silver, uint256 gold, uint256 diamond, uint256 vip);
    event AprsUpdated(uint16 bronze, uint16 silver, uint16 gold, uint16 diamond, uint16 vip);
    event RewardsFunded(address indexed from, uint256 amount);
    event RewardTokensRecovered(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param _ttsToken  TTS token address.
     * @param _admin     DEFAULT_ADMIN_ROLE holder (Gnosis Safe).
     * @param _manager   MANAGER_ROLE holder — thresholds/pause/recover (Gnosis Safe).
     * @param _upgrader  UPGRADER_ROLE holder — Safe+timelock ONLY, never Bank EOA.
     * Thresholds start unset (0) ⇒ 1x for all until MANAGER calls setTierThresholds.
     */
    function initialize(
        address _ttsToken,
        address _admin,
        address _manager,
        address _upgrader
    ) public initializer {
        require(_ttsToken != address(0), "zero token");
        require(_admin    != address(0), "zero admin");
        require(_manager  != address(0), "zero manager");
        require(_upgrader != address(0), "zero upgrader");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE,       _manager);
        _grantRole(UPGRADER_ROLE,      _upgrader);
        ttsToken = IERC20Upgradeable(_ttsToken);
        // Launch at the published APRs; the Safe may throttle later.
        aprBronze  = DEFAULT_APR_BRONZE;
        aprSilver  = DEFAULT_APR_SILVER;
        aprGold    = DEFAULT_APR_GOLD;
        aprDiamond = DEFAULT_APR_DIAMOND;
        aprVip     = DEFAULT_APR_VIP;
    }

    // ── Reward pool (surplus) ──────────────────────────────────────────────────

    /// @notice Reward budget available = total balance minus staked principal.
    /// Principal is never counted as reward surplus, so it can never be paid out.
    function rewardSurplus() public view returns (uint256) {
        uint256 bal = ttsToken.balanceOf(address(this));
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    /// @notice Fund the reward pool. Anyone may call; used to migrate the 10B pool.
    function fundRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        uint256 before = ttsToken.balanceOf(address(this));
        ttsToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = ttsToken.balanceOf(address(this)) - before;
        emit RewardsFunded(msg.sender, received);
    }

    /// @notice Reclaim UNUSED reward budget (governance wind-down). Bounded by
    /// surplus so principal is provably untouchable.
    function recoverRewardTokens(address to, uint256 amount)
        external
        onlyRole(MANAGER_ROLE)
        nonReentrant
    {
        require(to != address(0), "zero to");
        require(amount <= rewardSurplus(), "exceeds surplus");
        ttsToken.safeTransfer(to, amount);
        emit RewardTokensRecovered(to, amount);
    }

    // ── Core: stake / unstake / claim / emergency ──────────────────────────────

    /// @notice Stake (or top up). Credits the ACTUAL tokens received (fee-on-
    /// transfer safe). Any increase resets the 7-day multiplier-eligibility clock.
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "zero amount");
        StakeInfo storage s = _stakes[msg.sender];
        _settle(s);

        uint256 before = ttsToken.balanceOf(address(this));
        ttsToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = ttsToken.balanceOf(address(this)) - before;
        require(received > 0, "no tokens received");

        s.amount += received;
        totalStaked += received;
        s.eligibleAt = block.timestamp + MULTIPLIER_ELIGIBILITY; // reset on increase
        s.aprBps = _aprBpsForAmount(s.amount);

        emit Staked(msg.sender, received, s.amount, s.eligibleAt);
    }

    /// @notice Withdraw part or all of principal ANYTIME. Rewards keep accruing on
    /// whatever remains; already-accrued rewards stay claimable.
    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        StakeInfo storage s = _stakes[msg.sender];
        require(s.amount > 0, "no stake");
        require(amount > 0 && amount <= s.amount, "bad amount");
        _settle(s);

        s.amount -= amount;
        totalStaked -= amount;
        s.aprBps = _aprBpsForAmount(s.amount); // may drop tier / to 0

        ttsToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, s.amount);
    }

    /// @notice Claim settled rewards. Paid strictly from surplus; reverts if the
    /// pool cannot currently cover them (rewards stay accrued for a later claim).
    function claim() external whenNotPaused nonReentrant {
        StakeInfo storage s = _stakes[msg.sender];
        _settle(s);
        uint256 amt = s.accrued;
        require(amt > 0, "nothing to claim");
        require(rewardSurplus() >= amt, "insufficient reward pool");
        s.accrued = 0;
        totalRewardsPaid += amt;
        ttsToken.safeTransfer(msg.sender, amt);
        emit RewardsClaimed(msg.sender, amt);
    }

    /// @notice Always-open principal exit — works even when paused and never
    /// depends on the reward pool. Accrued rewards are preserved (claimable once
    /// unpaused); principal can never be trapped.
    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage s = _stakes[msg.sender];
        uint256 principal = s.amount;
        require(principal > 0, "no stake");
        _settle(s); // lock in accrued at the pre-exit rate; keep it claimable

        s.amount = 0;
        s.aprBps = 0;
        s.eligibleAt = 0;
        totalStaked -= principal;

        ttsToken.safeTransfer(msg.sender, principal);
        emit EmergencyWithdraw(msg.sender, principal);
    }

    /// @notice Permissionless: checkpoint `user`'s rewards at their current cached
    /// rate, then refresh the cached APR to the current amount-tier. Lets a staker
    /// (or a keeper) pick up a threshold change without a stake/unstake. Never
    /// changes principal and never applies a new rate retroactively.
    function refresh(address user) external nonReentrant {
        StakeInfo storage s = _stakes[user];
        if (s.amount == 0) return;
        _settle(s);
        s.aprBps = _aprBpsForAmount(s.amount);
    }

    // ── Reward accrual (lazy, per-user; no global loops) ───────────────────────

    function _settle(StakeInfo storage s) internal {
        if (s.lastAccrual != 0 && s.amount > 0 && s.aprBps > 0) {
            uint256 dt = block.timestamp - s.lastAccrual;
            if (dt > 0) {
                s.accrued += (s.amount * uint256(s.aprBps) * dt) / (BPS_DENOM * SECONDS_PER_YEAR);
            }
        }
        s.lastAccrual = block.timestamp;
    }

    // ── Voting integration seam (DO NOT change signature/semantics) ────────────

    /**
     * @notice Tier 0..4 for the voting contract. Reverts (⇒ V3d falls back to 1x
     * + unstaked cap) when: no stake, still inside the 7-day eligibility window,
     * thresholds unset, or below Bronze.
     */
    function getStakingTier(address user) external view returns (uint256) {
        StakeInfo storage s = _stakes[user];
        require(s.amount > 0,                  "no stake");
        require(block.timestamp >= s.eligibleAt, "not eligible");
        require(tierThresholdBronze > 0,       "tiers not initialized");
        uint256 a = s.amount;
        if (a >= tierThresholdVIP)     return 4;
        if (a >= tierThresholdDiamond) return 3;
        if (a >= tierThresholdGold)    return 2;
        if (a >= tierThresholdSilver)  return 1;
        if (a >= tierThresholdBronze)  return 0;
        revert("below minimum stake");
    }

    /// @notice e18 vote multiplier; never reverts. 1x unless a position is
    /// eligible (>=7d) AND at/above Bronze.
    function getMultiplier(address user) external view returns (uint256) {
        StakeInfo storage s = _stakes[user];
        if (s.amount == 0 || block.timestamp < s.eligibleAt || tierThresholdBronze == 0) {
            return MULTIPLIER_BASE;
        }
        uint256 a = s.amount;
        if (a >= tierThresholdVIP)     return MULTIPLIER_VIP;
        if (a >= tierThresholdDiamond) return MULTIPLIER_DIAMOND;
        if (a >= tierThresholdGold)    return MULTIPLIER_GOLD;
        if (a >= tierThresholdSilver)  return MULTIPLIER_SILVER;
        if (a >= tierThresholdBronze)  return MULTIPLIER_BRONZE;
        return MULTIPLIER_BASE;
    }

    // ── Views for UI / admin dashboard ─────────────────────────────────────────

    /// @notice tier by amount alone, ignoring eligibility. -1 if none/below Bronze.
    function amountTier(address user) public view returns (int256) {
        uint256 a = _stakes[user].amount;
        if (a == 0 || tierThresholdBronze == 0 || a < tierThresholdBronze) return -1;
        if (a >= tierThresholdVIP)     return 4;
        if (a >= tierThresholdDiamond) return 3;
        if (a >= tierThresholdGold)    return 2;
        if (a >= tierThresholdSilver)  return 1;
        return 0;
    }

    /// @notice Live pending rewards (settled + unsettled) without mutating state.
    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo storage s = _stakes[user];
        uint256 p = s.accrued;
        if (s.lastAccrual != 0 && s.amount > 0 && s.aprBps > 0) {
            uint256 dt = block.timestamp - s.lastAccrual;
            p += (s.amount * uint256(s.aprBps) * dt) / (BPS_DENOM * SECONDS_PER_YEAR);
        }
        return p;
    }

    /// @notice Full snapshot for the dashboard / stake UI.
    function getStakeDetails(address user)
        external
        view
        returns (
            uint256 principal,
            uint256 eligibleAt,
            bool    eligibleNow,
            int256  tierByAmount,
            uint16  aprBps,
            uint256 pending,
            uint256 claimableNow
        )
    {
        StakeInfo storage s = _stakes[user];
        principal   = s.amount;
        eligibleAt  = s.eligibleAt;
        eligibleNow = s.amount > 0 && block.timestamp >= s.eligibleAt;
        tierByAmount = amountTier(user);
        aprBps      = s.aprBps;
        pending     = pendingRewards(user);
        uint256 surplus = rewardSurplus();
        claimableNow = pending <= surplus ? pending : surplus;
    }

    function getStakeInfo(address user) external view returns (uint256 amount, uint256 eligibleAt) {
        StakeInfo storage s = _stakes[user];
        return (s.amount, s.eligibleAt);
    }

    // ── Admin: thresholds ──────────────────────────────────────────────────────

    /**
     * @notice Manually set tier thresholds (TTS amounts). Enforces strict ascending
     * order and, for any already-set threshold, a max ±MAX_THRESHOLD_DEVIATION×
     * change per edit (fat-finger / bad-price guard). First set (old==0) is exempt
     * from the deviation guard.
     */
    function setTierThresholds(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _diamond,
        uint256 _vip
    ) external onlyRole(MANAGER_ROLE) {
        require(
            _bronze > 0 &&
            _bronze < _silver && _silver < _gold &&
            _gold < _diamond && _diamond < _vip,
            "not strictly ascending"
        );
        _guardDeviation(tierThresholdBronze,  _bronze);
        _guardDeviation(tierThresholdSilver,  _silver);
        _guardDeviation(tierThresholdGold,    _gold);
        _guardDeviation(tierThresholdDiamond, _diamond);
        _guardDeviation(tierThresholdVIP,     _vip);

        tierThresholdBronze  = _bronze;
        tierThresholdSilver  = _silver;
        tierThresholdGold    = _gold;
        tierThresholdDiamond = _diamond;
        tierThresholdVIP     = _vip;
        emit TierThresholdsUpdated(_bronze, _silver, _gold, _diamond, _vip);
    }

    function _guardDeviation(uint256 oldV, uint256 newV) internal pure {
        if (oldV == 0) return; // first-time set is unrestricted
        require(newV <= oldV * MAX_THRESHOLD_DEVIATION, "increase too large");
        require(newV >= oldV / MAX_THRESHOLD_DEVIATION, "decrease too large");
    }

    // ── Admin: pause ────────────────────────────────────────────────────────────
    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    // ── Internal: tier APR by amount ────────────────────────────────────────────
    function _aprBpsForAmount(uint256 amount) internal view returns (uint16) {
        uint256 b = tierThresholdBronze;
        if (b == 0 || amount < b) return 0;
        if (amount >= tierThresholdVIP)     return aprVip;
        if (amount >= tierThresholdDiamond) return aprDiamond;
        if (amount >= tierThresholdGold)    return aprGold;
        if (amount >= tierThresholdSilver)  return aprSilver;
        return aprBronze;
    }

    /**
     * @notice Governance lever to adjust per-tier APRs (bps) — protects the reward
     * pool runway without a contract upgrade. Enforces tier ordering, a 200% hard
     * ceiling, and a ≤MAX_THRESHOLD_DEVIATION× per-edit change guard. Existing
     * stakers keep their cached rate until their next stake/unstake/claim or a
     * refresh(), so a change never applies retroactively.
     */
    function setAprBps(
        uint16 _bronze,
        uint16 _silver,
        uint16 _gold,
        uint16 _diamond,
        uint16 _vip
    ) external onlyRole(MANAGER_ROLE) {
        require(_bronze > 0, "zero apr");
        require(
            _bronze <= _silver && _silver <= _gold &&
            _gold <= _diamond && _diamond <= _vip,
            "apr not ascending"
        );
        require(_vip <= MAX_APR_BPS, "apr too high");
        _guardDeviation(aprBronze,  _bronze);
        _guardDeviation(aprSilver,  _silver);
        _guardDeviation(aprGold,    _gold);
        _guardDeviation(aprDiamond, _diamond);
        _guardDeviation(aprVip,     _vip);
        aprBronze  = _bronze;
        aprSilver  = _silver;
        aprGold    = _gold;
        aprDiamond = _diamond;
        aprVip     = _vip;
        emit AprsUpdated(_bronze, _silver, _gold, _diamond, _vip);
    }

    // ── UUPS ────────────────────────────────────────────────────────────────────
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
