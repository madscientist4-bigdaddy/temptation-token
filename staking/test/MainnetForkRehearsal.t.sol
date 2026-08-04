// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "../src/TTSStaking.sol";
import "../src/RescueUUPS.sol";
import "../mocks/Mocks.sol"; // TestProxy

/**
 * PHASE 1 - full mainnet-fork rehearsal of the ENTIRE staking go-live, including the
 * exact extraction of the stranded 10B out of the old broken proxy. NO mainnet writes.
 *
 * Run: cd staking && BASE_RPC_URL=<alchemy> forge test \
 *        --match-path test/MainnetForkRehearsal.t.sol --evm-version cancun -vv
 */
interface ITTS {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function isTaxExempt(address) external view returns (bool);
    function setTaxExempt(address, bool) external;
}
interface IV3d {
    function setStakingContract(address) external;
    function stakingContract() external view returns (address);
    function tierVoteCap(address) external view returns (uint256);
}
interface IOldUUPS { function upgradeTo(address) external; }
interface IRescue { function rescue(address, address, uint256) external; function tokenBalance(address) external view returns (uint256); }

contract MainnetForkRehearsal is Test {
    ITTS constant TTS = ITTS(0x5570eA97d53A53170e973894A9Fa7feb5785d3b9);
    IV3d constant V3D = IV3d(0x783B8cd80B586B723188C93EF94EE1BEedE617B4);
    address constant OLD_PROXY = 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc; // stranded 10B
    address constant BANK      = 0xB1E991bF617459B58964eEf7756B350e675C53b5; // V3d.admin + old-proxy UPGRADER
    address constant SAFE      = 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86; // TTS DEFAULT_ADMIN
    address constant TREASURY  = 0xC3A3858A3777E4C9B542e60298c3161086c5Faae; // tax-exempt, funds alice

    TTSStaking staking;
    address alice = address(0xA11CE);

    uint256 constant T_BRONZE  =    50_000e18;
    uint256 constant T_SILVER  =   100_000e18;
    uint256 constant T_GOLD    =   250_000e18;
    uint256 constant T_DIAMOND = 1_000_000e18;
    uint256 constant T_VIP     = 5_000_000e18;
    uint256 constant TEN_B     = 10_000_000_000e18;

    function setUp() public {
        try vm.envString("BASE_RPC_URL") returns (string memory) {
            vm.createSelectFork(vm.rpcUrl("base"));
        } catch { vm.skip(true); return; }

        // Deploy new staking; UPGRADER = timelock (Safe proposer/executor), admin+manager = this test.
        address[] memory role = new address[](1); role[0] = SAFE;
        TimelockController timelock = new TimelockController(1 hours, role, role, address(0));
        TTSStaking impl = new TTSStaking();
        bytes memory init = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(TTS), address(this), address(this), address(timelock)
        );
        staking = TTSStaking(address(new TestProxy(address(impl), init)));
    }

    /// The whole sequence, in order, with hard-stop asserts at each step.
    function test_FullGoLiveRehearsal() public {
        // ── 0. baseline: 10B really is stranded in the old proxy ──
        assertEq(TTS.balanceOf(OLD_PROXY), TEN_B, "10B in old proxy");
        assertEq(staking.rewardSurplus(), 0, "new pool empty");

        // ── 1. EXTRACTION: Bank upgrades old UUPS proxy to RescueUUPS, then pulls funds ──
        RescueUUPS rescueImpl = new RescueUUPS();
        vm.prank(BANK); IOldUUPS(OLD_PROXY).upgradeTo(address(rescueImpl));
        assertEq(IRescue(OLD_PROXY).tokenBalance(address(TTS)), TEN_B, "rescue impl live on proxy");

        // STAGED: 1,000 TTS first, verify accounting, then the remainder.
        vm.prank(BANK); IRescue(OLD_PROXY).rescue(address(TTS), address(staking), 1_000e18);
        assertEq(staking.rewardSurplus(), 1_000e18, "staged 1k landed in pool");
        assertEq(TTS.balanceOf(OLD_PROXY), TEN_B - 1_000e18, "proxy debited 1k");

        vm.prank(BANK); IRescue(OLD_PROXY).rescue(address(TTS), address(staking), TEN_B - 1_000e18);
        assertEq(staking.rewardSurplus(), TEN_B, "full 10B pool");
        assertEq(TTS.balanceOf(OLD_PROXY), 0, "proxy fully drained - no limbo");

        // ── 2. tax-exempt the new staking (Safe = TTS DEFAULT_ADMIN) ──
        vm.prank(SAFE); TTS.setTaxExempt(address(staking), true);
        assertTrue(TTS.isTaxExempt(address(staking)), "staking tax-exempt");

        // ── 3. thresholds (manager = this) + wire V3d (Bank = V3d.admin) ──
        staking.setTierThresholds(T_BRONZE, T_SILVER, T_GOLD, T_DIAMOND, T_VIP);
        vm.prank(BANK); V3D.setStakingContract(address(staking));
        assertEq(V3D.stakingContract(), address(staking), "V3d repointed to new staking");

        // ── 4. E2E with a test wallet (funded from tax-exempt Treasury) ──
        vm.prank(TREASURY); TTS.transfer(alice, 6_000_000e18);
        vm.startPrank(alice);
        TTS.approve(address(staking), type(uint256).max);
        staking.stake(5_000_000e18); // VIP amount
        vm.stopPrank();

        (uint256 principal,) = staking.getStakeInfo(alice);
        assertEq(principal, 5_000_000e18, "full principal credited (tax-exempt)");

        // 7-day eligibility clock: tier gated, V3d sees unstaked fallback
        assertEq(V3D.tierVoteCap(alice), 500e18, "pre-eligibility fallback via real V3d");
        vm.warp(block.timestamp + 7 days + 1);
        assertEq(staking.getStakingTier(alice), 4, "VIP tier after 7d");
        assertEq(staking.getMultiplier(alice), 3e18, "3x multiplier");
        assertEq(V3D.tierVoteCap(alice), type(uint256).max, "VIP uncapped via real V3d");

        // accrue → claim real TTS from the migrated 10B pool
        vm.warp(block.timestamp + 365 days);
        uint256 pending = staking.pendingRewards(alice);
        assertGt(pending, 0, "rewards accrue");
        uint256 balBefore = TTS.balanceOf(alice);
        vm.prank(alice); staking.claim();
        assertEq(TTS.balanceOf(alice), balBefore + pending, "claim paid in full (tax-exempt)");
        assertGe(TTS.balanceOf(address(staking)), staking.totalStaked(), "principal still backed");

        // unstake → principal returns in full
        uint256 preUnstake = TTS.balanceOf(alice);
        vm.prank(alice); staking.unstake(5_000_000e18);
        assertEq(staking.totalStaked(), 0, "fully unstaked");
        assertEq(TTS.balanceOf(alice), preUnstake + 5_000_000e18, "principal returned in full");

        emit log_string("ALL GREEN - extraction + tax-exempt + wire + full stake lifecycle rehearsed on mainnet fork");
    }
}
