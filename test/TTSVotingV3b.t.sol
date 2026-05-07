// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/forge-std/src/Test.sol";

// ── Minimal mock: ERC-20 that returns bool and mints on demand ──────────────

contract MockTTS {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ── Minimal mock: staking contract (tier 0 = no boost) ─────────────────────

contract MockStaking {
    function getStakingTier(address) external pure returns (uint256) {
        return 0;
    }
}

// ── Minimal mock: VRF coordinator ──────────────────────────────────────────

contract MockVRFCoordinator {
    uint256 private _nextRequestId = 1;

    // Records the last voting contract to call requestRandomWords so we can
    // call rawFulfillRandomWords on it directly in tests.
    address public lastCaller;
    uint256 public lastRequestId;

    function requestRandomWords(bytes calldata) external returns (uint256 requestId) {
        requestId = _nextRequestId++;
        lastCaller = msg.sender;
        lastRequestId = requestId;
    }
}

// ── Import the contract under test ─────────────────────────────────────────

import "../TTSVotingV3b.sol";

// ── Test suite ─────────────────────────────────────────────────────────────

contract TTSVotingV3bTest is Test {
    TTSVotingV3b  voting;
    MockTTS       token;
    MockStaking   staking;
    MockVRFCoordinator vrf;

    address owner   = address(0xA11CE);
    address admin_  = address(0xA11CE); // same as owner in this setup
    address charity = address(0xCAFE1);
    address house   = address(0xCAFE2);
    address voter1  = address(0xB0B);
    address voter2  = address(0xDAD);
    address profile1Wallet = address(0xF001);
    address profile2Wallet = address(0xF002);

    bytes32 constant KEY_HASH = bytes32(uint256(1));
    uint256 constant SUB_ID   = 12345;

    function setUp() public {
        token   = new MockTTS();
        staking = new MockStaking();
        vrf     = new MockVRFCoordinator();

        vm.prank(owner);
        voting = new TTSVotingV3b(
            address(token),
            address(vrf),
            KEY_HASH,
            SUB_ID,
            address(staking),
            charity,
            house
        );

        // Fund voters
        token.mint(voter1, 1_000_000e18);
        token.mint(voter2, 1_000_000e18);

        // Approve contract to spend
        vm.prank(voter1);
        token.approve(address(voting), type(uint256).max);
        vm.prank(voter2);
        token.approve(address(voting), type(uint256).max);

        // Start round (owner == keeper in tests)
        vm.prank(owner);
        voting.startRound(7 days);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: First vote of a round succeeds (CRITICAL #1 regression test)
    //
    // Before the fix: newRoundRaw == newProfileRaw on first vote, so the check
    //   newProfileRaw * 10000 <= newRoundRaw * 4000
    // evaluated to:
    //   amount * 10000 <= amount * 4000  →  false  → revert "Exceeds vote cap"
    //
    // After the fix: the require is skipped when newRoundRaw == newProfileRaw.
    // ─────────────────────────────────────────────────────────────────────────
    function test_firstVoteSucceeds() public {
        // Approve a single profile
        vm.prank(admin_);
        voting.approveProfile("profile1", profile1Wallet);

        uint256 amount = 100e18;
        uint256 balBefore = token.balanceOf(voter1);

        vm.prank(voter1);
        voting.vote("profile1", amount);

        // Tokens transferred into contract
        assertEq(token.balanceOf(voter1), balBefore - amount, "voter1 balance mismatch");
        assertEq(token.balanceOf(address(voting)), amount, "contract balance mismatch");

        // State updated
        (, , uint256 rawVotes, , ) = voting.getProfile(voting.currentRoundId(), "profile1");
        assertEq(rawVotes, amount, "profile rawVotes mismatch");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Vote cap blocks votes over 40% when multiple profiles exist
    //
    // Setup: profile1 and profile2 both approved.
    //        voter2 puts 100 TTS on profile2 first (baseline in pool).
    //        voter1 then tries to put 70 TTS on profile1 → 70/170 > 40% → revert.
    //        voter1 then puts 50 TTS on profile1 → 50/150 = 33.3% → ok.
    // ─────────────────────────────────────────────────────────────────────────
    function test_voteCapBloksOver40Pct() public {
        vm.prank(admin_);
        voting.approveProfile("profile1", profile1Wallet);
        vm.prank(admin_);
        voting.approveProfile("profile2", profile2Wallet);

        // voter2 seeds the pool with 100 TTS on profile2
        vm.prank(voter2);
        voting.vote("profile2", 100e18);

        // voter1 attempts to put 70 TTS on profile1 — that would be 70/170 = 41.2% → revert
        vm.expectRevert("Exceeds vote cap");
        vm.prank(voter1);
        voting.vote("profile1", 70e18);

        // voter1 puts 50 TTS on profile1 — 50/150 = 33.3% → ok
        vm.prank(voter1);
        voting.vote("profile1", 50e18);

        (, , uint256 rawVotes, , ) = voting.getProfile(voting.currentRoundId(), "profile1");
        assertEq(rawVotes, 50e18, "profile1 rawVotes should be 50 TTS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Zero wallet address rejected on profile approval (HIGH #2)
    // ─────────────────────────────────────────────────────────────────────────
    function test_zeroWalletRejected() public {
        vm.expectRevert("Zero wallet");
        vm.prank(admin_);
        voting.approveProfile("profile_zero", address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: batchApproveProfiles also rejects zero wallet (HIGH #2)
    // ─────────────────────────────────────────────────────────────────────────
    function test_batchZeroWalletRejected() public {
        string[] memory ids = new string[](2);
        address[] memory wallets = new address[](2);
        ids[0] = "profile1";
        ids[1] = "profile2";
        wallets[0] = profile1Wallet;
        wallets[1] = address(0);  // second entry is zero

        vm.expectRevert("Zero wallet");
        vm.prank(admin_);
        voting.batchApproveProfiles(ids, wallets);
    }
}
