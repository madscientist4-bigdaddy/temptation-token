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
 * @title TTSStakingV2
 * @notice UUPS upgradeable staking contract for Temptation Token ($TTS).
 *
 * Storage layout is byte-identical to V1 (proxy 0xaA12B889...) through slot 354.
 * Slots 355–359 are new V2 state variables (tier thresholds).
 *
 * V2 changes vs V1:
 *   - MULTIPLIER_DIAMOND 1.75→2.0e18 (Diamond = 2x, matches canonical spec)
 *   - MULTIPLIER_VIP     2.0→3.0e18  (VIP = 3x, matches canonical spec)
 *   - New: getStakingTier(address) — returns tier 0-4; reverts for unstaked
 *   - New: tierThreshold* admin-configurable storage vars (slots 355-359)
 *   - New: initializeV2() with reinitializer(2)
 *   - New: setTierThresholds() callable by MANAGER_ROLE
 *
 * DO NOT DEPLOY — surface for human review before Bank wallet signs upgradeTo().
 *
 * Proxy:          0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc
 * V1 impl:        0x370b8fd7cfa4abf1b16cbf1d9c7b875907f523ca
 * UPGRADER_ROLE:  0xb1e991bf617459b58964eef7756b350e675c53b5 (Bank wallet)
 */
contract TTSStakingV2 is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant MANAGER_ROLE  = keccak256("MANAGER_ROLE");

    // ── Lock period constants (identical to V1) ───────────────────────────────
    uint256 public constant LOCK_90_DAYS  =  7_776_000; //  90 × 86400
    uint256 public constant LOCK_180_DAYS = 15_552_000; // 180 × 86400
    uint256 public constant LOCK_365_DAYS = 31_536_000; // 365 × 86400

    // ── Multiplier constants (e18-scaled) — V2 CORRECTED VALUES ──────────────
    // Old V1 selectors (for reference):
    //   0xbc3f501f → 1.00e18  0xb2dee394 → 1.10e18  0x41213459 → 1.25e18
    //   0x7498951d → 1.50e18  0x13880331 → 1.75e18 (Diamond — WAS WRONG)
    //   0x87034124 → 2.00e18  0xbf18b5d2 → 3.00e18
    uint256 public constant MULTIPLIER_BASE    = 1_000_000_000_000_000_000; // 1.00x (unstaked)
    uint256 public constant MULTIPLIER_BRONZE  = 1_100_000_000_000_000_000; // 1.10x Bronze
    uint256 public constant MULTIPLIER_SILVER  = 1_250_000_000_000_000_000; // 1.25x Silver
    uint256 public constant MULTIPLIER_GOLD    = 1_500_000_000_000_000_000; // 1.50x Gold
    uint256 public constant MULTIPLIER_DIAMOND = 2_000_000_000_000_000_000; // 2.00x Diamond (V2 fix)
    uint256 public constant MULTIPLIER_VIP     = 3_000_000_000_000_000_000; // 3.00x VIP     (V2 fix)

    struct StakeInfo {
        uint256 amount;   // TTS staked (18-decimal)
        uint256 lockEnd;  // unix timestamp when lock expires
    }

    // ── Storage slots 351–354 — MUST match V1 byte-for-byte ──────────────────
    // Storage slot derivation: 1(Init) + 50(Context) + 50(ERC165) + 50(AccessControl)
    //   + 50(ReentrancyGuard) + 50(Pausable) + 50(ERC1967Upgrade) + 50(UUPS) = 351
    IERC20Upgradeable public ttsToken;              // slot 351
    address           public treasury;              // slot 352
    uint256           public totalStaked;            // slot 353
    mapping(address => StakeInfo) private _stakes;  // slot 354 (mapping base)

    // ── New V2 storage (slots 355–359) ────────────────────────────────────────
    // TTS-denominated tier thresholds — admin must update as TTS price changes.
    // USD targets (CLAUDE.md): Bronze $50, Silver $100, Gold $250, Diamond $1k, VIP $5k
    uint256 public tierThresholdBronze;   // min TTS → Bronze  tier (0)
    uint256 public tierThresholdSilver;   // min TTS → Silver  tier (1)
    uint256 public tierThresholdGold;     // min TTS → Gold    tier (2)
    uint256 public tierThresholdDiamond;  // min TTS → Diamond tier (3)
    uint256 public tierThresholdVIP;      // min TTS → VIP     tier (4)

    // ── Events ────────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount, uint256 lockEnd);
    event Unstaked(address indexed user, uint256 amount);
    event TierThresholdsUpdated(
        uint256 bronze, uint256 silver, uint256 gold, uint256 diamond, uint256 vip
    );

    // ── Constructor (disables direct initialisation on impl) ─────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── V1 initializer (preserved verbatim) ──────────────────────────────────
    function initialize(address _ttsToken, address _treasury) public initializer {
        require(_ttsToken  != address(0), "zero token");
        require(_treasury  != address(0), "zero treasury");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE,      msg.sender);
        _grantRole(MANAGER_ROLE,       msg.sender);
        ttsToken = IERC20Upgradeable(_ttsToken);
        treasury = _treasury;
    }

    // ── V2 upgrade initializer ────────────────────────────────────────────────
    /**
     * @notice Call once immediately after upgradeTo(V2_impl) from Bank wallet.
     *   reinitializer(2) ensures this runs exactly once and never again.
     *
     * @param _bronze   Min TTS staked to reach Bronze  tier (~$50 USD at current price)
     * @param _silver   Min TTS staked to reach Silver  tier (~$100 USD)
     * @param _gold     Min TTS staked to reach Gold    tier (~$250 USD)
     * @param _diamond  Min TTS staked to reach Diamond tier (~$1,000 USD)
     * @param _vip      Min TTS staked to reach VIP     tier (~$5,000 USD)
     *
     * Example (TTS at $0.001 USD):
     *   _bronze  =  50_000e18   ( 50,000 TTS ≈ $50)
     *   _silver  = 100_000e18   (100,000 TTS ≈ $100)
     *   _gold    = 250_000e18   (250,000 TTS ≈ $250)
     *   _diamond = 1_000_000e18 (1M TTS ≈ $1,000)
     *   _vip     = 5_000_000e18 (5M TTS ≈ $5,000)
     */
    function initializeV2(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _diamond,
        uint256 _vip
    ) public reinitializer(2) onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _bronze > 0  && _bronze  < _silver &&
            _silver < _gold  && _gold   < _diamond &&
            _diamond < _vip,
            "invalid thresholds"
        );
        tierThresholdBronze  = _bronze;
        tierThresholdSilver  = _silver;
        tierThresholdGold    = _gold;
        tierThresholdDiamond = _diamond;
        tierThresholdVIP     = _vip;
        emit TierThresholdsUpdated(_bronze, _silver, _gold, _diamond, _vip);
    }

    // ── Core staking ──────────────────────────────────────────────────────────
    /**
     * @notice Stake TTS tokens for the default 90-day lock period.
     *   Each address may hold exactly one active stake.
     */
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "zero amount");
        require(_stakes[msg.sender].amount == 0, "already staked");
        uint256 lockEnd = block.timestamp + LOCK_90_DAYS;
        _stakes[msg.sender] = StakeInfo({amount: amount, lockEnd: lockEnd});
        totalStaked += amount;
        ttsToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, lockEnd);
    }

    /**
     * @notice Unstake and return all TTS to msg.sender.
     *   Reverts if lock has not expired.
     */
    function unstake() external whenNotPaused nonReentrant {
        StakeInfo storage s = _stakes[msg.sender];
        require(s.amount > 0,                    "no stake");
        require(block.timestamp >= s.lockEnd,    "locked");
        uint256 amount = s.amount;
        delete _stakes[msg.sender];
        totalStaked -= amount;
        ttsToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    // ── View functions ────────────────────────────────────────────────────────
    /**
     * @notice Returns the e18-scaled vote multiplier for a voter.
     *   Returns MULTIPLIER_BASE (1e18) for unstaked or sub-Bronze addresses.
     *   Before initializeV2 is called (thresholds == 0), always returns base.
     */
    function getMultiplier(address user) external view returns (uint256) {
        uint256 amount = _stakes[user].amount;
        if (amount == 0 || tierThresholdBronze == 0) return MULTIPLIER_BASE;
        if (amount >= tierThresholdVIP)              return MULTIPLIER_VIP;
        if (amount >= tierThresholdDiamond)          return MULTIPLIER_DIAMOND;
        if (amount >= tierThresholdGold)             return MULTIPLIER_GOLD;
        if (amount >= tierThresholdSilver)           return MULTIPLIER_SILVER;
        if (amount >= tierThresholdBronze)           return MULTIPLIER_BRONZE;
        return MULTIPLIER_BASE;
    }

    /**
     * @notice Returns the staking tier number (0–4) for a staker.
     *   - 0 = Bronze  ($50 USD min stake)
     *   - 1 = Silver  ($100 USD)
     *   - 2 = Gold    ($250 USD)
     *   - 3 = Diamond ($1,000 USD)
     *   - 4 = VIP     ($5,000 USD)
     *
     *   Reverts "no stake" for addresses with no active stake — the calling
     *   voting contract (TTSVotingV3b/V3c) uses try/catch around this call and
     *   falls back to 1x multiplier / VOTE_CAP_UNSTAKED on revert.
     *
     *   Reverts "tiers not initialized" if initializeV2 has not been called yet.
     *   Reverts "below minimum stake" if staked amount is below Bronze threshold.
     */
    function getStakingTier(address user) external view returns (uint256) {
        require(_stakes[user].amount > 0, "no stake");
        require(tierThresholdBronze  > 0, "tiers not initialized");
        uint256 amount = _stakes[user].amount;
        if (amount >= tierThresholdVIP)     return 4;
        if (amount >= tierThresholdDiamond) return 3;
        if (amount >= tierThresholdGold)    return 2;
        if (amount >= tierThresholdSilver)  return 1;
        if (amount >= tierThresholdBronze)  return 0;
        revert("below minimum stake");
    }

    /**
     * @notice Returns the amount and lock expiry for a given staker.
     *   Reverts "no stake" for unstaked addresses.
     */
    function getStakeInfo(address user)
        external view
        returns (uint256 amount, uint256 lockEnd)
    {
        require(_stakes[user].amount > 0, "no stake");
        return (_stakes[user].amount, _stakes[user].lockEnd);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    /**
     * @notice Update tier thresholds as TTS price moves.
     *   MANAGER_ROLE can call any time; enforces strict ascending order.
     */
    function setTierThresholds(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _diamond,
        uint256 _vip
    ) external onlyRole(MANAGER_ROLE) {
        require(
            _bronze > 0  && _bronze  < _silver &&
            _silver < _gold  && _gold   < _diamond &&
            _diamond < _vip,
            "invalid thresholds"
        );
        tierThresholdBronze  = _bronze;
        tierThresholdSilver  = _silver;
        tierThresholdGold    = _gold;
        tierThresholdDiamond = _diamond;
        tierThresholdVIP     = _vip;
        emit TierThresholdsUpdated(_bronze, _silver, _gold, _diamond, _vip);
    }

    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    // ── UUPS ──────────────────────────────────────────────────────────────────
    function _authorizeUpgrade(address)
        internal override onlyRole(UPGRADER_ROLE) {}
}
