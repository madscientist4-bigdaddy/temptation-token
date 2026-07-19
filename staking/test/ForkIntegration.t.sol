// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "../src/TTSStaking.sol";
import "../mocks/Mocks.sol"; // TestProxy

/**
 * Gate D — BASE MAINNET-FORK integration against the REAL TTS token and REAL
 * TTSVotingV3d. Proves the whole system, not the contract in isolation:
 *   - real V3d.tierVoteCap reads my getStakingTier through the 7-day gate,
 *   - real 1% transfer tax + exemption behave as on mainnet,
 *   - stake / accrue / claim / unstake / emergency all work with real TTS.
 * NO mainnet writes — all state changes live in the local fork.
 *
 * Run: cd staking && BASE_RPC_URL=<alchemy> forge test --match-path test/ForkIntegration.t.sol -vv
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

contract ForkIntegrationTest is Test {
    // Real Base mainnet addresses (CLAUDE.md canonical set)
    ITTS constant TTS  = ITTS(0x5570eA97d53A53170e973894A9Fa7feb5785d3b9);
    IV3d constant V3D  = IV3d(0x783B8cd80B586B723188C93EF94EE1BEedE617B4);
    address constant BANK     = 0xB1E991bF617459B58964eEf7756B350e675C53b5; // V3d.admin
    address constant SAFE     = 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86; // TTS DEFAULT_ADMIN
    address constant TREASURY = 0xC3A3858A3777E4C9B542e60298c3161086c5Faae; // tax-exempt, 20B TTS

    TTSStaking staking;
    address alice = address(0xA11CE);

    uint256 constant T_BRONZE  =    50_000e18;
    uint256 constant T_SILVER  =   100_000e18;
    uint256 constant T_GOLD    =   250_000e18;
    uint256 constant T_DIAMOND = 1_000_000e18;
    uint256 constant T_VIP     = 5_000_000e18;

    function setUp() public {
        // Env-gated: only runs when BASE_RPC_URL is set (fork command below).
        // Requires --evm-version cancun to execute real Base bytecode (PUSH0).
        //   BASE_RPC_URL=<alchemy> forge test --match-path test/ForkIntegration.t.sol --evm-version cancun -vv
        try vm.envString("BASE_RPC_URL") returns (string memory) {
            vm.createSelectFork(vm.rpcUrl("base"));
        } catch {
            vm.skip(true);
            return;
        }

        // Deploy new staking; UPGRADER = a fresh timelock (never an EOA).
        address[] memory role = new address[](1); role[0] = SAFE;
        TimelockController timelock = new TimelockController(1 hours, role, role, address(0));
        TTSStaking impl = new TTSStaking();
        bytes memory init = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(TTS), address(this), address(this), address(timelock)
        );
        staking = TTSStaking(address(new TestProxy(address(impl), init)));
        staking.setTierThresholds(T_BRONZE, T_SILVER, T_GOLD, T_DIAMOND, T_VIP);

        // Mirror the mainnet migration steps (as Safe / Bank):
        vm.prank(SAFE);  TTS.setTaxExempt(address(staking), true); // principal untaxed
        vm.prank(BANK);  V3D.setStakingContract(address(staking)); // repoint voting

        // Fund alice + reward pool from the tax-exempt Treasury (untaxed).
        vm.startPrank(TREASURY);
        TTS.transfer(alice, 6_000_000e18);
        TTS.transfer(address(staking), 100_000e18); // seed reward pool
        vm.stopPrank();
    }

    function test_Fork_realV3dReadsTierThroughGate() public {
        assertEq(V3D.stakingContract(), address(staking), "V3d repointed");

        vm.startPrank(alice);
        TTS.approve(address(staking), type(uint256).max);
        staking.stake(5_000_000e18); // VIP amount
        vm.stopPrank();

        // Full principal credited (staking is tax-exempt).
        (uint256 principal,) = staking.getStakeInfo(alice);
        assertEq(principal, 5_000_000e18);

        // BEFORE eligibility: real V3d sees the fallback (unstaked cap 500).
        assertEq(V3D.tierVoteCap(alice), 500e18, "pre-eligibility fallback");

        // AFTER 7 days: real V3d reads VIP tier ⇒ uncapped vote.
        vm.warp(block.timestamp + 7 days + 1);
        assertEq(staking.getStakingTier(alice), 4);
        assertEq(staking.getMultiplier(alice), 3e18);
        assertEq(V3D.tierVoteCap(alice), type(uint256).max, "VIP uncapped via real V3d");
    }

    function test_Fork_fullLifecycle_realTTS() public {
        vm.startPrank(alice);
        TTS.approve(address(staking), type(uint256).max);
        staking.stake(300_000e18); // Gold
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days + 1);
        assertEq(V3D.tierVoteCap(alice), 5000e18, "Gold cap via real V3d");

        // Accrue ~1 year, claim real TTS from the pool.
        vm.warp(block.timestamp + 365 days);
        uint256 pending = staking.pendingRewards(alice);
        assertGt(pending, 0);
        uint256 balBefore = TTS.balanceOf(alice);
        vm.prank(alice);
        staking.claim();
        assertEq(TTS.balanceOf(alice), balBefore + pending);
        // principal still fully backed
        assertGe(TTS.balanceOf(address(staking)), staking.totalStaked());

        // Partial then full unstake, real tokens returned.
        vm.prank(alice); staking.unstake(100_000e18);
        vm.prank(alice); staking.unstake(200_000e18);
        assertEq(staking.totalStaked(), 0);
    }

    function test_Fork_emergencyWithdrawWhilePaused() public {
        vm.startPrank(alice);
        TTS.approve(address(staking), type(uint256).max);
        staking.stake(300_000e18);
        vm.stopPrank();

        staking.pause(); // test contract holds MANAGER
        uint256 balBefore = TTS.balanceOf(alice);
        vm.prank(alice);
        staking.emergencyWithdraw();
        assertEq(TTS.balanceOf(alice), balBefore + 300_000e18);
        assertEq(staking.totalStaked(), 0);
    }
}
