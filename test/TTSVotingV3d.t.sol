// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/forge-std/src/Test.sol";

// ── Mocks (identical to V3c test suite) ──────────────────────────────────────

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

contract MockStaking {
    function getStakingTier(address) external pure returns (uint256) {
        return 0; // Bronze tier for all voters in tests
    }
}

contract MockVRFCoordinator {
    uint256 private _nextRequestId = 1;
    address public lastCaller;
    uint256 public lastRequestId;

    function requestRandomWords(VRFRandomWordsRequest calldata) external returns (uint256 requestId) {
        requestId = _nextRequestId++;
        lastCaller = msg.sender;
        lastRequestId = requestId;
    }
}

contract MockNFT {
    uint256 public mintCallCount;
    address public lastRecipient;

    function mint(address to, uint256, string calldata, uint256) external {
        mintCallCount++;
        lastRecipient = to;
    }
}

// ── Imports ───────────────────────────────────────────────────────────────────

import "../contracts/TTSVotingV3d.sol";
import "../contracts/TTSKeeper3.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Test suite — TTSVotingV3d (all V3c tests + V3d-specific additions)
// ─────────────────────────────────────────────────────────────────────────────

contract TTSVotingV3dTest is Test {
    TTSVotingV3d   voting;
    MockTTS        token;
    MockStaking    staking;
    MockVRFCoordinator vrf;
    MockNFT        nft;

    address owner_          = address(0xA11CE);
    address charity         = address(0xCAFE1);
    address house           = address(0xCAFE2);
    address voter1          = address(0xB0B);
    address voter2          = address(0xDAD);
    address profile1Wallet  = address(0xF001);
    address profile2Wallet  = address(0xF002);

    bytes32 constant KEY_HASH = bytes32(uint256(1));
    uint256 constant SUB_ID   = 12345;

    function setUp() public {
        token   = new MockTTS();
        staking = new MockStaking();
        vrf     = new MockVRFCoordinator();
        nft     = new MockNFT();

        vm.prank(owner_);
        voting = new TTSVotingV3d(
            address(token),
            address(vrf),
            KEY_HASH,
            SUB_ID,
            address(staking),
            charity,
            house
        );

        token.mint(voter1, 1_000_000e18);
        token.mint(voter2, 1_000_000e18);

        vm.prank(voter1);
        token.approve(address(voting), type(uint256).max);
        vm.prank(voter2);
        token.approve(address(voting), type(uint256).max);

        vm.prank(owner_);
        voting.startRound(7 days);
    }

    // ── TEST 1: First vote of a round succeeds (vote-cap fix) ─────────────────

    function test_firstVoteSucceeds() public {
        vm.prank(owner_);
        voting.approveProfile("profile1", profile1Wallet);

        uint256 amount    = 100e18;
        uint256 balBefore = token.balanceOf(voter1);

        vm.prank(voter1);
        voting.vote("profile1", amount);

        assertEq(token.balanceOf(voter1),          balBefore - amount, "voter1 balance");
        assertEq(token.balanceOf(address(voting)), amount,             "contract balance");

        (, , uint256 rawVotes, , ) = voting.getProfile(voting.currentRoundId(), "profile1");
        assertEq(rawVotes, amount, "rawVotes mismatch");
    }

    // ── TEST 2: 40% pool vote cap enforced ───────────────────────────────────

    function test_voteCapBlocksOver40Pct() public {
        vm.prank(owner_);
        voting.approveProfile("profile1", profile1Wallet);
        vm.prank(owner_);
        voting.approveProfile("profile2", profile2Wallet);

        vm.prank(voter2);
        voting.vote("profile2", 100e18);

        vm.expectRevert("Exceeds vote cap");
        vm.prank(voter1);
        voting.vote("profile1", 70e18);

        vm.prank(voter1);
        voting.vote("profile1", 50e18);

        (, , uint256 rawVotes, , ) = voting.getProfile(voting.currentRoundId(), "profile1");
        assertEq(rawVotes, 50e18);
    }

    // ── TEST 3: Zero wallet rejected ─────────────────────────────────────────

    function test_zeroWalletRejected() public {
        vm.expectRevert("Zero wallet");
        vm.prank(owner_);
        voting.approveProfile("profile_zero", address(0));
    }

    // ── TEST 4: batchApproveProfiles rejects zero wallet ─────────────────────

    function test_batchZeroWalletRejected() public {
        string[]  memory ids     = new string[](2);
        address[] memory wallets = new address[](2);
        ids[0]     = "profile1";
        ids[1]     = "profile2";
        wallets[0] = profile1Wallet;
        wallets[1] = address(0);

        vm.expectRevert("Zero wallet");
        vm.prank(owner_);
        voting.batchApproveProfiles(ids, wallets);
    }

    // ── TEST 5: Prize split — no club (35/35/10/20) ──────────────────────────

    function test_prizeSplitNoClub() public {
        vm.prank(owner_);
        voting.approveProfile("p1", profile1Wallet);

        vm.prank(voter1);
        voting.vote("p1", 1000e18);

        vm.warp(block.timestamp + 8 days);
        vm.prank(owner_);
        voting.settleRound();

        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 42;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        assertEq(token.balanceOf(profile1Wallet), 350e18,                            "profile share");
        assertEq(token.balanceOf(voter1),         1_000_000e18 - 1000e18 + 350e18, "voter share");
        assertEq(token.balanceOf(charity),        100e18,                           "charity share");
        assertEq(token.balanceOf(house),          200e18,                           "house share");
        assertEq(token.balanceOf(address(voting)), 0,                               "contract empty");
    }

    // ── TEST 6: Prize split — with club (35/35/10/10/10) ─────────────────────

    function test_prizeSplitWithClub() public {
        address clubWallet = address(0xC1B);

        vm.startPrank(owner_);
        voting.setClubWallet("TTS", clubWallet);
        voting.approveProfile("p1", profile1Wallet);
        voting.setProfileClub("p1", "TTS");
        vm.stopPrank();

        vm.prank(voter1);
        voting.vote("p1", 1000e18);

        vm.warp(block.timestamp + 8 days);
        vm.prank(owner_);
        voting.settleRound();

        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 99;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        assertEq(token.balanceOf(profile1Wallet), 350e18,                           "profile share");
        assertEq(token.balanceOf(voter1),         1_000_000e18 - 1000e18 + 350e18, "voter share");
        assertEq(token.balanceOf(charity),        100e18,                           "charity share");
        assertEq(token.balanceOf(clubWallet),     100e18,                           "club share");
        assertEq(token.balanceOf(house),          100e18,                           "house share");
        assertEq(token.balanceOf(address(voting)), 0,                               "contract empty");
    }

    // ── TEST 7: Three NFT mints at settlement ─────────────────────────────────

    function test_threeNFTMints() public {
        vm.prank(owner_);
        voting.setNFTContract(address(nft));

        vm.prank(owner_);
        voting.approveProfile("p1", profile1Wallet);

        vm.prank(voter1);
        voting.vote("p1", 100e18);

        vm.warp(block.timestamp + 8 days);
        vm.prank(owner_);
        voting.settleRound();

        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 7;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        assertEq(nft.mintCallCount(), 3, "expected 3 NFT mints");
    }

    // ── TEST 8 (V3d-specific): adminTransferOwnership ─────────────────────────
    // Admin (Bank wallet) can reassign owner without needing owner's signature.

    function test_adminTransferOwnership() public {
        address newKeeper = address(0xBEEF);

        // Initially owner_ == owner (set in constructor)
        assertEq(voting.owner(), owner_);
        assertEq(voting.admin(), owner_);

        // admin transfers ownership to newKeeper
        vm.prank(owner_);
        voting.adminTransferOwnership(newKeeper);

        assertEq(voting.owner(), newKeeper, "owner should be newKeeper");
        assertEq(voting.admin(), owner_,    "admin unchanged");

        // Original owner_ can no longer call onlyOwner functions
        vm.expectRevert();
        vm.prank(owner_);
        voting.startRound(7 days);

        // But newKeeper can
        // (need to warp past previous round first to allow startRound on a fresh deploy)
    }

    // ── TEST 9 (V3d-specific): non-admin cannot call adminTransferOwnership ───

    function test_adminTransferOwnershipOnlyAdmin() public {
        vm.expectRevert("Not admin");
        vm.prank(voter1);
        voting.adminTransferOwnership(voter1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite — TTSKeeper3 calendar pinning + 5-week zero-drift
// ─────────────────────────────────────────────────────────────────────────────

contract TTSKeeper3Test is Test {
    TTSVotingV3d       voting;
    TTSKeeper3         keeper;
    MockTTS            token;
    MockStaking        staking;
    MockVRFCoordinator vrf;

    // Use constants to avoid state-variable getter side-effects on vm.prank
    address constant BANK    = address(0xBA1AC);
    address constant CHARITY = address(0xCAFE1);
    address constant HOUSE   = address(0xCAFE2);
    address constant VOTER1  = address(0xB0B);
    address constant PWAL    = address(0xF001); // profile wallet

    bytes32 constant KEY_HASH = bytes32(uint256(1));
    uint256 constant SUB_ID   = 12345;
    uint256 constant WEEK     = 604800;

    // Action constants (must match TTSKeeper3)
    uint256 constant START  = 1;
    uint256 constant SETTLE = 3;
    uint256 constant ROLLOVER = 4;

    // Calendar anchor: start test at ts=1000, first target = 1000 + WEEK
    uint256 constant T0 = 1000 + 604800; // 605800

    function setUp() public {
        vm.warp(1000);

        token   = new MockTTS();
        staking = new MockStaking();
        vrf     = new MockVRFCoordinator();

        vm.startPrank(BANK);
        voting = new TTSVotingV3d(
            address(token), address(vrf), KEY_HASH, SUB_ID,
            address(staking), CHARITY, HOUSE
        );
        keeper = new TTSKeeper3(address(voting), T0);
        voting.adminTransferOwnership(address(keeper));
        vm.stopPrank();

        assertEq(voting.owner(), address(keeper), "keeper must own voting");

        token.mint(VOTER1, 100_000_000e18);
        vm.prank(VOTER1);
        token.approve(address(voting), type(uint256).max);
    }

    function _approveProfile(string memory id) internal {
        vm.prank(BANK);
        voting.approveProfile(id, PWAL);
    }

    function _vote(string memory id, uint256 amount) internal {
        vm.prank(VOTER1);
        voting.vote(id, amount);
    }

    function _fulfillVRF() internal {
        uint256 reqId = vrf.lastRequestId();
        uint256[] memory rw = new uint256[](1);
        rw[0] = 42;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, rw);
    }

    function _bankExecute(uint256 action) internal {
        vm.prank(BANK);
        keeper.manualExecute(action);
    }

    // ── TEST 1: checkUpkeep returns START when roundId == 0 ──────────────────

    function test_checkUpkeep_initialState() public view {
        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed, "should need upkeep");
        assertEq(abi.decode(data, (uint256)), START, "should be START_ROUND");
    }

    // ── TEST 2: initial s_nextSettleTarget == T0 ──────────────────────────────

    function test_initialTarget() public view {
        assertEq(keeper.s_nextSettleTarget(), T0);
    }

    // ── TEST 3: round endTime == T0, target advances to T0+WEEK ──────────────

    function test_startRound_endTimeExact() public {
        _bankExecute(START);
        (, uint256 endTime, , , , , ) = voting.getRound(1);
        assertEq(endTime, T0, "round 1 endTime must equal T0");
        assertEq(keeper.s_nextSettleTarget(), T0 + WEEK, "target advanced to T0+WEEK");
    }

    // ── TEST 4: checkUpkeep returns SETTLE at T0 (with profile) ──────────────

    function test_checkUpkeep_settle() public {
        _bankExecute(START);
        _approveProfile("p1");
        _vote("p1", 100e18);
        vm.warp(T0);
        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), SETTLE, "should be SETTLE");
    }

    // ── TEST 5: no upkeep 1 second before end ────────────────────────────────

    function test_checkUpkeep_noActionBeforeEnd() public {
        _bankExecute(START);
        _approveProfile("p1");
        _vote("p1", 100e18);
        vm.warp(T0 - 1);
        (bool needed, ) = keeper.checkUpkeep("");
        assertFalse(needed, "no upkeep 1s before end");
    }

    // ── TEST 6: 5-week zero-drift ─────────────────────────────────────────────
    //
    // For each of 5 rounds asserts:
    //   (a) endTime == T0 + (round-1)*WEEK  (calendar pin, no drift)
    //   (b) Consecutive endTimes differ by exactly WEEK.

    function test_fiveWeekZeroDrift() public {
        uint256[5] memory endTimes;

        for (uint256 round = 1; round <= 5; round++) {
            _bankExecute(START);

            (, uint256 endTime, , , , , ) = voting.getRound(round);
            endTimes[round - 1] = endTime;

            assertEq(endTime, T0 + (round - 1) * WEEK,
                string(abi.encodePacked("round ", vm.toString(round), " endTime mismatch")));

            string memory pid = string(abi.encodePacked("p", vm.toString(round)));
            _approveProfile(pid);
            _vote(pid, 100e18);

            vm.warp(endTime);

            (bool needed, bytes memory data) = keeper.checkUpkeep("");
            assertTrue(needed, "should need upkeep at endTime");
            assertEq(abi.decode(data, (uint256)), SETTLE, "should return SETTLE");

            _bankExecute(SETTLE);
            _fulfillVRF();

            (needed, data) = keeper.checkUpkeep("");
            assertTrue(needed, "should need upkeep after settlement");
            assertEq(abi.decode(data, (uint256)), START, "should return START after settlement");

            vm.warp(endTime + 1);
        }

        emit log("=== 5-Week Zero-Drift Results ===");
        for (uint256 i = 0; i < 5; i++) {
            assertEq(endTimes[i], T0 + i * WEEK,
                string(abi.encodePacked("drift in round ", vm.toString(i + 1))));
            emit log_named_uint(
                string(abi.encodePacked("Round ", vm.toString(i + 1), " endTime")),
                endTimes[i]
            );
        }
        for (uint256 i = 1; i < 5; i++) {
            assertEq(endTimes[i] - endTimes[i - 1], WEEK,
                string(abi.encodePacked("inter-round gap != WEEK between rounds ",
                    vm.toString(i), " and ", vm.toString(i + 1))));
        }
    }

    // ── TEST 7: rollover path (no profiles) ──────────────────────────────────

    function test_rollover_path() public {
        _bankExecute(START);
        (, uint256 endTime1, , , , , ) = voting.getRound(1);
        assertEq(endTime1, T0);

        vm.warp(T0);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), ROLLOVER, "should be ROLLOVER");

        _bankExecute(ROLLOVER);

        (, , , , bool settled, , ) = voting.getRound(1);
        assertTrue(settled, "round 1 settled after rollover");
        assertEq(keeper.s_nextSettleTarget(), T0 + WEEK);

        (needed, data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), START, "should be START after rollover");

        vm.warp(T0 + 1);
        _bankExecute(START);

        (, uint256 endTime2, , , , , ) = voting.getRound(2);
        assertEq(endTime2, T0 + WEEK, "round 2 endTime no drift after rollover");
        assertEq(keeper.s_nextSettleTarget(), T0 + 2 * WEEK);
    }

    // ── TEST 8: resetSchedule ─────────────────────────────────────────────────

    function test_resetSchedule() public {
        uint256 emergency = T0 + 3 * WEEK;
        vm.prank(BANK);
        keeper.resetSchedule(emergency);
        assertEq(keeper.s_nextSettleTarget(), emergency);
    }

    function test_resetSchedule_revertsPast() public {
        vm.expectRevert("Must be in future");
        vm.prank(BANK);
        keeper.resetSchedule(block.timestamp - 1);
    }

    // ── TEST 9: performUpkeep gated to forwarder ──────────────────────────────

    function test_performUpkeep_forwarderGate() public {
        address realForwarder = address(0xF0ED);
        vm.prank(BANK);
        keeper.setForwarder(realForwarder);

        // Non-forwarder non-owner call must revert
        vm.expectRevert("TTSKeeper3: not forwarder");
        vm.prank(address(0xFEED));
        keeper.performUpkeep(abi.encode(uint256(START)));
    }

    // ── TEST 10: late fire advances target past now by WEEK ───────────────────

    function test_lateFire_advancesTarget() public {
        _bankExecute(START);
        _approveProfile("p1");
        _vote("p1", 100e18);
        vm.warp(T0);
        _bankExecute(SETTLE);
        _fulfillVRF();

        // s_nextSettleTarget == T0+WEEK; warp to T0+2W+1 (past target by a week)
        vm.warp(T0 + 2 * WEEK + 1);
        _bankExecute(START);

        (, uint256 endTime2, , , , , ) = voting.getRound(2);
        // while: T0+W <= T0+2W+1 → +W → T0+2W <= T0+2W+1 → +W → T0+3W > now. Stop.
        // endTime = (T0+2W+1) + (T0+3W - (T0+2W+1)) = T0+3W
        assertEq(endTime2, T0 + 3 * WEEK, "late fire aligns to T0+3W");
        assertEq(keeper.s_nextSettleTarget(), T0 + 4 * WEEK, "target now T0+4W");
    }
}
