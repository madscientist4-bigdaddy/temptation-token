// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../src/TTSStaking.sol";
import "../mocks/Mocks.sol";

contract TTSStakingBase is Test {
    TTSStaking     staking;
    MockTTSTax     tts;

    address admin    = address(0xA0);
    address manager  = address(0xB0);
    address upgrader = address(0xC0); // stands in for Safe+timelock
    address treasury = address(0x7A0);

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address carol = address(0xCAC0);

    // Example thresholds (TTS ~$0.001): 50k / 100k / 250k / 1M / 5M
    uint256 constant T_BRONZE  =    50_000e18;
    uint256 constant T_SILVER  =   100_000e18;
    uint256 constant T_GOLD    =   250_000e18;
    uint256 constant T_DIAMOND = 1_000_000e18;
    uint256 constant T_VIP     = 5_000_000e18;

    uint256 constant YEAR = 365 days;

    function _deploy() internal {
        tts = new MockTTSTax(treasury);
        TTSStaking impl = new TTSStaking();
        bytes memory data = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(tts), admin, manager, upgrader
        );
        TestProxy proxy = new TestProxy(address(impl), data);
        staking = TTSStaking(address(proxy));
        // Mirror mainnet: staking contract is tax-exempt so users get full principal.
        tts.setTaxExempt(address(staking), true);
    }

    function _setThresholds() internal {
        vm.prank(manager);
        staking.setTierThresholds(T_BRONZE, T_SILVER, T_GOLD, T_DIAMOND, T_VIP);
    }

    function _fund(address who, uint256 amt) internal {
        tts.mint(who, amt);
        vm.prank(who);
        tts.approve(address(staking), type(uint256).max);
    }

    function _fundPool(uint256 amt) internal {
        tts.mint(address(this), amt);
        tts.approve(address(staking), type(uint256).max);
        staking.fundRewards(amt);
    }

    function setUp() public virtual {
        _deploy();
        _setThresholds();
    }
}

contract TTSStakingUnitTest is TTSStakingBase {
    // ── Principal accounting ──────────────────────────────────────────────────
    function test_Stake_creditsPrincipal_whenExempt() public {
        _fund(alice, 60_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        (uint256 principal,) = staking.getStakeInfo(alice);
        assertEq(principal, 60_000e18);
        assertEq(staking.totalStaked(), 60_000e18);
        assertEq(tts.balanceOf(address(staking)), 60_000e18);
    }

    function test_Stake_feeOnTransfer_creditsNet_invariantHolds() public {
        // Staking NOT tax-exempt → 1% tax on the inbound transfer.
        tts.setTaxExempt(address(staking), false);
        _fund(alice, 100_000e18);
        vm.prank(alice);
        staking.stake(100_000e18);
        (uint256 principal,) = staking.getStakeInfo(alice);
        // credited = actual received = 99% of 100k
        assertEq(principal, 99_000e18);
        assertEq(staking.totalStaked(), 99_000e18);
        // INV: balance >= totalStaked
        assertGe(tts.balanceOf(address(staking)), staking.totalStaked());
    }

    function test_Unstake_anytime_noLock() public {
        _fund(alice, 60_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        // immediately unstake — principal is never locked
        vm.prank(alice);
        staking.unstake(60_000e18);
        assertEq(tts.balanceOf(alice), 60_000e18);
        assertEq(staking.totalStaked(), 0);
    }

    function test_PartialUnstake_keepsRemainder() public {
        _fund(alice, 60_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        vm.prank(alice);
        staking.unstake(10_000e18);
        (uint256 principal,) = staking.getStakeInfo(alice);
        assertEq(principal, 50_000e18);
        assertEq(tts.balanceOf(alice), 10_000e18);
    }

    // ── 7-day multiplier-eligibility gate ─────────────────────────────────────
    function test_Tier_reverts_beforeEligible() public {
        _fund(alice, 60_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        vm.expectRevert(bytes("not eligible"));
        staking.getStakingTier(alice);
        // getMultiplier is non-reverting and returns base
        assertEq(staking.getMultiplier(alice), 1e18);
    }

    function test_Tier_active_afterEligible() public {
        _fund(alice, 60_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        vm.warp(block.timestamp + 7 days);
        assertEq(staking.getStakingTier(alice), 0); // Bronze
        assertEq(staking.getMultiplier(alice), 1.10e18);
    }

    function test_TopUp_resetsEligibilityClock() public {
        _fund(alice, 6_000_000e18);
        vm.prank(alice);
        staking.stake(60_000e18);
        vm.warp(block.timestamp + 7 days);
        assertEq(staking.getStakingTier(alice), 0);
        // top up to VIP — eligibility must reset (anti flash-upgrade)
        vm.prank(alice);
        staking.stake(5_000_000e18);
        vm.expectRevert(bytes("not eligible"));
        staking.getStakingTier(alice);
        vm.warp(block.timestamp + 7 days);
        assertEq(staking.getStakingTier(alice), 4); // VIP now
    }

    function test_PartialUnstake_doesNotResetEligibility() public {
        _fund(alice, 300_000e18);
        vm.prank(alice);
        staking.stake(300_000e18); // Gold
        vm.warp(block.timestamp + 7 days);
        assertEq(staking.getStakingTier(alice), 2);
        vm.prank(alice);
        staking.unstake(250_000e18); // down to 50k → Bronze, still eligible
        assertEq(staking.getStakingTier(alice), 0);
    }

    // ── Tier boundaries ───────────────────────────────────────────────────────
    function test_TierBoundaries() public {
        _tierAt(T_BRONZE, 0);
        _tierAt(T_SILVER - 1, 0);
        _tierAt(T_SILVER, 1);
        _tierAt(T_GOLD, 2);
        _tierAt(T_DIAMOND, 3);
        _tierAt(T_VIP, 4);
        _tierAt(T_VIP + 1e18, 4);
    }

    function _tierAt(uint256 amt, uint256 expected) internal {
        address u = address(uint160(uint256(keccak256(abi.encode(amt)))));
        _fund(u, amt);
        vm.prank(u);
        staking.stake(amt);
        vm.warp(block.timestamp + 7 days + 1);
        assertEq(staking.getStakingTier(u), expected, "tier boundary");
    }

    function test_BelowBronze_revertsTier() public {
        _fund(alice, T_BRONZE - 1);
        vm.prank(alice);
        staking.stake(T_BRONZE - 1);
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(bytes("below minimum stake"));
        staking.getStakingTier(alice);
    }

    // ── Reward accrual math (per-tier APR) ────────────────────────────────────
    function test_Reward_bronzeAPR_oneYear() public {
        _fundPool(1_000_000e18);
        _fund(alice, T_BRONZE);
        vm.prank(alice);
        staking.stake(T_BRONZE);
        vm.warp(block.timestamp + YEAR);
        // 8% of 50k = 4000
        assertApproxEqAbs(staking.pendingRewards(alice), 4_000e18, 1e12);
    }

    function test_Reward_perTierAPR_oneYear() public {
        _checkAPR(T_SILVER,  1200); // 12%
        _checkAPR(T_GOLD,    1800); // 18%
        _checkAPR(T_DIAMOND, 3200); // 32%
        _checkAPR(T_VIP,     4500); // 45%
    }

    function _checkAPR(uint256 amt, uint256 bps) internal {
        address u = address(uint160(uint256(keccak256(abi.encode("apr", amt)))));
        _fund(u, amt);
        vm.prank(u);
        staking.stake(amt);
        uint256 t0 = block.timestamp;
        vm.warp(t0 + YEAR);
        uint256 expected = amt * bps / 10_000;
        assertApproxEqAbs(staking.pendingRewards(u), expected, expected / 1e6 + 1);
        vm.warp(t0); // reset for next iteration determinism
    }

    // ── Claim pays only from surplus ──────────────────────────────────────────
    function test_Claim_paysFromSurplus_notPrincipal() public {
        _fundPool(1_000_000e18);
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        vm.warp(block.timestamp + YEAR);
        uint256 pending = staking.pendingRewards(alice);
        uint256 poolBefore = staking.rewardSurplus();
        vm.prank(alice);
        staking.claim();
        assertEq(tts.balanceOf(alice), pending);
        // principal still fully backed
        assertEq(staking.totalStaked(), T_GOLD);
        assertGe(tts.balanceOf(address(staking)), staking.totalStaked());
        assertApproxEqAbs(staking.rewardSurplus(), poolBefore - pending, 1);
    }

    function test_Claim_revertsWhenPoolEmpty() public {
        // No pool funded. Stake and accrue, then claim must revert (pool empty).
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        vm.warp(block.timestamp + YEAR);
        vm.prank(alice);
        vm.expectRevert(bytes("insufficient reward pool"));
        staking.claim();
        // principal remains withdrawable
        vm.prank(alice);
        staking.unstake(T_GOLD);
        assertEq(tts.balanceOf(alice), T_GOLD);
    }

    // ── Emergency withdraw ────────────────────────────────────────────────────
    function test_Emergency_worksWhenPaused_returnsPrincipal() public {
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        vm.prank(manager);
        staking.pause();
        // normal unstake blocked while paused
        vm.prank(alice);
        vm.expectRevert(bytes("Pausable: paused"));
        staking.unstake(T_GOLD);
        // emergency always open
        vm.prank(alice);
        staking.emergencyWithdraw();
        assertEq(tts.balanceOf(alice), T_GOLD);
        assertEq(staking.totalStaked(), 0);
    }

    function test_Emergency_preservesAccruedRewards() public {
        _fundPool(1_000_000e18);
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        vm.warp(block.timestamp + YEAR);
        uint256 pending = staking.pendingRewards(alice);
        vm.prank(alice);
        staking.emergencyWithdraw();
        // principal back, rewards preserved and claimable
        assertEq(tts.balanceOf(alice), T_GOLD);
        assertApproxEqAbs(staking.pendingRewards(alice), pending, 1);
        vm.prank(alice);
        staking.claim();
        assertApproxEqAbs(tts.balanceOf(alice), T_GOLD + pending, 1e12);
    }

    // ── Pause semantics ───────────────────────────────────────────────────────
    function test_Pause_blocksStakeAndClaim() public {
        _fund(alice, T_GOLD);
        vm.prank(manager);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert(bytes("Pausable: paused"));
        staking.stake(T_GOLD);
    }

    // ── Thresholds ────────────────────────────────────────────────────────────
    function test_Thresholds_mustAscend() public {
        vm.prank(manager);
        vm.expectRevert(bytes("not strictly ascending"));
        staking.setTierThresholds(100e18, 50e18, 250e18, 1000e18, 5000e18);
    }

    function test_Thresholds_deviationGuard_blocksHugeJump() public {
        // current bronze = 50k; 5x jump (>4x) must revert
        vm.prank(manager);
        vm.expectRevert(bytes("increase too large"));
        staking.setTierThresholds(250_001e18, 300_000e18, 400_000e18, 1_500_000e18, 6_000_000e18);
    }

    function test_Thresholds_deviationGuard_allowsReasonableChange() public {
        vm.prank(manager);
        staking.setTierThresholds(100_000e18, 200_000e18, 500_000e18, 2_000_000e18, 10_000_000e18);
        assertEq(staking.tierThresholdBronze(), 100_000e18);
    }

    function test_Thresholds_changeThenRefresh_updatesAPR() public {
        _fund(alice, 100_000e18);
        vm.prank(alice);
        staking.stake(100_000e18); // Silver → 12%
        (, , , , uint16 apr0, ,) = staking.getStakeDetails(alice);
        assertEq(apr0, 1200);
        // Lower thresholds so 100k becomes Gold-eligible (250k→~90k). Use 2x steps.
        vm.prank(manager);
        staking.setTierThresholds(25_000e18, 50_000e18, 90_000e18, 400_000e18, 2_000_000e18);
        // stale until refresh
        staking.refresh(alice);
        (, , , , uint16 apr1, ,) = staking.getStakeDetails(alice);
        assertEq(apr1, 1800); // Gold now
    }

    // ── Access control ────────────────────────────────────────────────────────
    function test_AC_onlyManager_setsThresholds() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setTierThresholds(T_BRONZE, T_SILVER, T_GOLD, T_DIAMOND, T_VIP);
    }

    function test_AC_onlyManager_pauses() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.pause();
    }

    function test_AC_onlyManager_recovers() public {
        _fundPool(1_000e18);
        vm.prank(alice);
        vm.expectRevert();
        staking.recoverRewardTokens(alice, 1e18);
    }

    function test_AC_onlyUpgrader_authorizes() public {
        TTSStaking impl2 = new TTSStaking();
        vm.prank(alice);
        vm.expectRevert();
        staking.upgradeTo(address(impl2));
        // manager also cannot upgrade (only UPGRADER_ROLE)
        vm.prank(manager);
        vm.expectRevert();
        staking.upgradeTo(address(impl2));
        // upgrader can
        vm.prank(upgrader);
        staking.upgradeTo(address(impl2));
    }

    // ── Recover reward tokens can never touch principal ───────────────────────
    function test_Recover_boundedBySurplus() public {
        _fundPool(1_000e18);
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        // surplus == 1000; trying to take principal reverts
        vm.prank(manager);
        vm.expectRevert(bytes("exceeds surplus"));
        staking.recoverRewardTokens(manager, 1_001e18);
        // exactly surplus ok, principal untouched
        vm.prank(manager);
        staking.recoverRewardTokens(manager, 1_000e18);
        assertEq(staking.rewardSurplus(), 0);
        assertEq(staking.totalStaked(), T_GOLD);
        assertGe(tts.balanceOf(address(staking)), staking.totalStaked());
        vm.prank(alice);
        staking.unstake(T_GOLD);
        assertEq(tts.balanceOf(alice), T_GOLD);
    }

    // ── Adjustable APR governance lever ───────────────────────────────────────
    function test_APR_defaultsToPublished() public {
        assertEq(staking.aprBronze(), 800);
        assertEq(staking.aprVip(), 4500);
    }

    function test_APR_onlyManager() public {
        vm.prank(alice);
        vm.expectRevert();
        staking.setAprBps(400, 600, 900, 1600, 2250);
    }

    function test_APR_mustAscendAndCeiling() public {
        vm.prank(manager);
        vm.expectRevert(bytes("apr not ascending"));
        staking.setAprBps(1200, 800, 900, 1600, 2250);
        vm.prank(manager);
        vm.expectRevert(bytes("apr too high"));
        staking.setAprBps(800, 1200, 1800, 3200, 20_001);
    }

    function test_APR_deviationGuard() public {
        // >4x jump from 800 → 4000 must revert
        vm.prank(manager);
        vm.expectRevert(bytes("increase too large"));
        staking.setAprBps(4000, 5000, 6000, 7000, 8000);
    }

    function test_APR_throttleHalvesEmissions() public {
        _fundPool(1_000_000e18);
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD); // cached at Gold 18%
        // Halve all APRs (Safe throttles to protect runway).
        vm.prank(manager);
        staking.setAprBps(400, 600, 900, 1600, 2250);
        staking.refresh(alice); // pick up new rate
        (, , , , uint16 apr, ,) = staking.getStakeDetails(alice);
        assertEq(apr, 900); // Gold now 9%
        vm.warp(block.timestamp + YEAR);
        assertApproxEqAbs(staking.pendingRewards(alice), T_GOLD * 900 / 10000, T_GOLD / 1e6 + 1);
    }

    // ── Multi-user independent accrual ────────────────────────────────────────
    function test_MultiUser_independentAccrual() public {
        _fundPool(10_000_000e18);
        _fund(alice, T_BRONZE);
        _fund(bob, T_VIP);
        vm.prank(alice); staking.stake(T_BRONZE);
        vm.prank(bob);   staking.stake(T_VIP);
        vm.warp(block.timestamp + YEAR);
        assertApproxEqAbs(staking.pendingRewards(alice), T_BRONZE * 800 / 10000, 1e12);
        assertApproxEqAbs(staking.pendingRewards(bob),   T_VIP   * 4500 / 10000, 1e15);
    }
}

contract TTSStakingIntegrationStubTest is TTSStakingBase {
    StubVotingV3d voting;

    function setUp() public override {
        super.setUp();
        voting = new StubVotingV3d(address(staking));
    }

    function test_Voting_ineligible_getsBaseAndUnstakedCap() public {
        _fund(alice, T_VIP);
        vm.prank(alice);
        staking.stake(T_VIP);
        // inside 7-day window: voting sees fallback (1x, 500 cap)
        assertEq(voting.multiplierApplied(alice, 1000e18), 1000e18);
        assertEq(voting.tierVoteCap(alice), 500e18);
    }

    function test_Voting_eligibleVIP_getsBoostAndUncappedVote() public {
        _fund(alice, T_VIP);
        vm.prank(alice);
        staking.stake(T_VIP);
        vm.warp(block.timestamp + 7 days);
        assertEq(voting.multiplierApplied(alice, 1000e18), 3000e18); // 3x
        assertEq(voting.tierVoteCap(alice), type(uint256).max);
    }

    function test_Voting_eligibleGold_boostAndCap() public {
        _fund(alice, T_GOLD);
        vm.prank(alice);
        staking.stake(T_GOLD);
        vm.warp(block.timestamp + 7 days);
        assertEq(voting.multiplierApplied(alice, 1000e18), 1500e18); // 1.5x
        assertEq(voting.tierVoteCap(alice), 5000e18);
    }
}

contract TTSStakingReentrancyTest is Test {
    TTSStaking staking;
    ReentrantToken rtoken;
    address admin = address(0xA0);
    address manager = address(0xB0);
    address upgrader = address(0xC0);
    address alice = address(0xA11CE);

    function setUp() public {
        rtoken = new ReentrantToken();
        TTSStaking impl = new TTSStaking();
        bytes memory data = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(rtoken), admin, manager, upgrader
        );
        TestProxy proxy = new TestProxy(address(impl), data);
        staking = TTSStaking(address(proxy));
        vm.prank(manager);
        staking.setTierThresholds(1e18, 2e18, 3e18, 4e18, 5e18);
        rtoken.mint(alice, 1_000e18);
        vm.prank(alice);
        rtoken.approve(address(staking), type(uint256).max);
    }

    function test_Reentrancy_stakeGuarded() public {
        rtoken.setAttack(address(staking), 1); // reenter stake during transferFrom
        vm.prank(alice);
        vm.expectRevert(); // ReentrancyGuard: reentrant call
        staking.stake(100e18);
    }

    function test_Reentrancy_unstakeGuarded() public {
        vm.prank(alice);
        staking.stake(100e18);
        rtoken.setAttack(address(staking), 2); // reenter unstake during transfer
        vm.prank(alice);
        vm.expectRevert();
        staking.unstake(50e18);
    }

    function test_Reentrancy_emergencyGuarded() public {
        vm.prank(alice);
        staking.stake(100e18);
        rtoken.setAttack(address(staking), 4);
        vm.prank(alice);
        vm.expectRevert();
        staking.emergencyWithdraw();
    }
}
