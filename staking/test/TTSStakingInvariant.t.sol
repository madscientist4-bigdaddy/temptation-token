// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TTSStaking.sol";
import "../mocks/Mocks.sol";

/**
 * @notice Stateful invariant handler. Drives random stake/unstake/claim/
 * emergency/fund/threshold/warp sequences across a fixed actor set and tracks
 * ghost totals so the invariants can assert:
 *   INV-1  balance >= totalStaked                (principal always fully backed)
 *   INV-2  Σ actor principal == totalStaked      (no accounting drift)
 *   INV-3  rewardSurplus == balance - totalStaked
 *   INV-4  Σ claimed <= Σ funded                 (rewards never exceed funded budget)
 */
contract StakingHandler is Test {
    TTSStaking public staking;
    MockTTSTax public tts;

    address[] public actors;
    uint256 public ghostFunded;
    uint256 public ghostClaimed;

    constructor(TTSStaking _staking, MockTTSTax _tts) {
        staking = _staking;
        tts = _tts;
        for (uint256 i = 0; i < 5; i++) {
            address a = address(uint160(0xACC0 + i));
            actors.push(a);
            vm.prank(a);
            tts.approve(address(staking), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function stake(uint256 seed, uint256 amt) external {
        address a = _actor(seed);
        amt = bound(amt, 1e18, 20_000_000e18);
        tts.mint(a, amt);
        vm.prank(a);
        try staking.stake(amt) {} catch {}
    }

    function unstake(uint256 seed, uint256 amt) external {
        address a = _actor(seed);
        (uint256 principal,) = staking.getStakeInfo(a);
        if (principal == 0) return;
        amt = bound(amt, 1, principal);
        vm.prank(a);
        try staking.unstake(amt) {} catch {}
    }

    function claim(uint256 seed) external {
        address a = _actor(seed);
        uint256 pending = staking.pendingRewards(a);
        vm.prank(a);
        try staking.claim() { ghostClaimed += pending; } catch {}
    }

    function emergency(uint256 seed) external {
        address a = _actor(seed);
        vm.prank(a);
        try staking.emergencyWithdraw() {} catch {}
    }

    function fund(uint256 amt) external {
        amt = bound(amt, 1e18, 100_000e18);
        tts.mint(address(this), amt);
        tts.approve(address(staking), type(uint256).max);
        try staking.fundRewards(amt) { ghostFunded += amt; } catch {}
    }

    function warp(uint256 dt) external {
        dt = bound(dt, 1, 120 days);
        vm.warp(block.timestamp + dt);
    }

    function setGhostFunded(uint256 v) external { ghostFunded = v; }
    function actorCount() external view returns (uint256) { return actors.length; }
    function actorAt(uint256 i) external view returns (address) { return actors[i]; }
}

contract TTSStakingInvariantTest is Test {
    TTSStaking staking;
    MockTTSTax tts;
    StakingHandler handler;

    address admin = address(0xA0);
    address manager = address(0xB0);
    address upgrader = address(0xC0);
    address treasury = address(0x7A0);

    function setUp() public {
        tts = new MockTTSTax(treasury);
        TTSStaking impl = new TTSStaking();
        bytes memory data = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(tts), admin, manager, upgrader
        );
        TestProxy proxy = new TestProxy(address(impl), data);
        staking = TTSStaking(address(proxy));
        tts.setTaxExempt(address(staking), true);

        vm.prank(manager);
        staking.setTierThresholds(50_000e18, 100_000e18, 250_000e18, 1_000_000e18, 5_000_000e18);

        handler = new StakingHandler(staking, tts);

        // Seed a reward pool so claims can succeed sometimes.
        tts.mint(address(this), 5_000_000e18);
        tts.approve(address(staking), type(uint256).max);
        staking.fundRewards(5_000_000e18);
        handler.setGhostFunded(5_000_000e18);

        // Fuzz only the action functions (exclude ghost setter / view helpers).
        bytes4[] memory sels = new bytes4[](6);
        sels[0] = handler.stake.selector;
        sels[1] = handler.unstake.selector;
        sels[2] = handler.claim.selector;
        sels[3] = handler.emergency.selector;
        sels[4] = handler.fund.selector;
        sels[5] = handler.warp.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sels}));
        targetContract(address(handler));
    }

    // INV-1: principal is always fully backed by contract balance.
    function invariant_balanceCoversPrincipal() public view {
        assertGe(tts.balanceOf(address(staking)), staking.totalStaked());
    }

    // INV-2: sum of per-actor principal equals totalStaked (no drift).
    function invariant_sumPrincipalEqualsTotal() public view {
        uint256 sum;
        uint256 n = handler.actorCount();
        for (uint256 i = 0; i < n; i++) {
            (uint256 p,) = staking.getStakeInfo(handler.actorAt(i));
            sum += p;
        }
        assertEq(sum, staking.totalStaked());
    }

    // INV-3: surplus is exactly balance - totalStaked.
    function invariant_surplusDefinition() public view {
        assertEq(staking.rewardSurplus(), tts.balanceOf(address(staking)) - staking.totalStaked());
    }

    // INV-4: rewards claimed never exceed rewards funded.
    function invariant_claimedNeverExceedsFunded() public view {
        assertLe(handler.ghostClaimed(), handler.ghostFunded());
    }
}
