// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/forge-std/src/Test.sol";

// ── Minimal mock: ERC-20 that tracks balances ──────────────────────────────

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

// ── Minimal mock: staking contract (tier 0 = Unstaked) ────────────────────

contract MockStaking {
    function getStakingTier(address) external pure returns (uint256) {
        return 0;
    }
}

// ── Minimal mock: VRF coordinator ─────────────────────────────────────────

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

// ── Minimal mock: NFT contract ────────────────────────────────────────────

contract MockNFT {
    uint256 public mintCallCount;
    address public lastRecipient;

    function mint(address to, uint256 /*roundId*/, string calldata /*profile*/, uint256 /*voteCount*/) external {
        mintCallCount++;
        lastRecipient = to;
    }
}

// ── Import the contract under test ────────────────────────────────────────

import "../contracts/TTSVotingV3c.sol";

// ── Test suite ────────────────────────────────────────────────────────────

contract TTSVotingV3cTest is Test {
    TTSVotingV3c    voting;
    MockTTS         token;
    MockStaking     staking;
    MockVRFCoordinator vrf;
    MockNFT         nft;

    address owner           = address(0xA11CE);
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

        vm.prank(owner);
        voting = new TTSVotingV3c(
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

        vm.prank(owner);
        voting.startRound(7 days);
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 1: First vote of a round succeeds (CRITICAL vote-cap fix)
    // ─────────────────────────────────────────────────────────────────────
    function test_firstVoteSucceeds() public {
        vm.prank(owner);
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

    // ─────────────────────────────────────────────────────────────────────
    // TEST 2: 40% pool vote cap still enforced
    // ─────────────────────────────────────────────────────────────────────
    function test_voteCapBloksOver40Pct() public {
        vm.prank(owner);
        voting.approveProfile("profile1", profile1Wallet);
        vm.prank(owner);
        voting.approveProfile("profile2", profile2Wallet);

        vm.prank(voter2);
        voting.vote("profile2", 100e18);

        vm.expectRevert("Exceeds vote cap");
        vm.prank(voter1);
        voting.vote("profile1", 70e18);

        vm.prank(voter1);
        voting.vote("profile1", 50e18);

        (, , uint256 rawVotes, , ) = voting.getProfile(voting.currentRoundId(), "profile1");
        assertEq(rawVotes, 50e18, "rawVotes should be 50 TTS");
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 3: Zero wallet rejected on approveProfile
    // ─────────────────────────────────────────────────────────────────────
    function test_zeroWalletRejected() public {
        vm.expectRevert("Zero wallet");
        vm.prank(owner);
        voting.approveProfile("profile_zero", address(0));
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 4: batchApproveProfiles rejects zero wallet
    // ─────────────────────────────────────────────────────────────────────
    function test_batchZeroWalletRejected() public {
        string[]  memory ids     = new string[](2);
        address[] memory wallets = new address[](2);
        ids[0]     = "profile1";
        ids[1]     = "profile2";
        wallets[0] = profile1Wallet;
        wallets[1] = address(0);

        vm.expectRevert("Zero wallet");
        vm.prank(owner);
        voting.batchApproveProfiles(ids, wallets);
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 5: Prize split — no club (35/35/10/20)
    //
    // voter1 puts 1000 TTS on profile1 (sole voter → top voter).
    // pool = 1000e18.  Expected payouts:
    //   profile1Wallet : 350e18   (35%)
    //   voter1          : 350e18   (35% — top voter = sole voter)
    //   charity         : 100e18   (10%)
    //   house           : 200e18   (20%)
    //   dead            : 0        (no residual — exact split)
    // ─────────────────────────────────────────────────────────────────────
    function test_prizeSplitNoClub() public {
        vm.prank(owner);
        voting.approveProfile("p1", profile1Wallet);

        uint256 voteAmount = 1000e18;
        vm.prank(voter1);
        voting.vote("p1", voteAmount);

        // Fast-forward past round end
        vm.warp(block.timestamp + 8 days);

        // Trigger settlement (owner == keeper in tests)
        vm.prank(owner);
        voting.settleRound();

        // Fulfill VRF — random word 0 selects winner by weighted ticket
        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 42;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        // Verify payouts — contract should have distributed everything
        assertEq(token.balanceOf(profile1Wallet), 350e18,                            "profile share");
        assertEq(token.balanceOf(voter1),         1_000_000e18 - 1000e18 + 350e18, "voter share");
        assertEq(token.balanceOf(charity),        100e18,                           "charity share");
        assertEq(token.balanceOf(house),          200e18,                           "house share");
        assertEq(token.balanceOf(address(voting)), 0,                               "contract should be empty");
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 6: Prize split — with club (35/35/10/10/10)
    //
    // Register club "TTS", attach to profile, run settlement.
    // pool = 1000e18.  Expected payouts:
    //   profile1Wallet : 350e18   (35%)
    //   voter1          : 350e18   (35%)
    //   charity         : 100e18   (10%)
    //   clubWallet      : 100e18   (10%)
    //   house           : 100e18   (10%)
    // ─────────────────────────────────────────────────────────────────────
    function test_prizeSplitWithClub() public {
        address clubWallet = address(0xC1B);

        vm.startPrank(owner);
        voting.setClubWallet("TTS", clubWallet);
        voting.approveProfile("p1", profile1Wallet);
        voting.setProfileClub("p1", "TTS");
        vm.stopPrank();

        vm.prank(voter1);
        voting.vote("p1", 1000e18);

        vm.warp(block.timestamp + 8 days);
        vm.prank(owner);
        voting.settleRound();

        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 99;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        assertEq(token.balanceOf(profile1Wallet), 350e18,                            "profile share");
        assertEq(token.balanceOf(voter1),         1_000_000e18 - 1000e18 + 350e18, "voter share");
        assertEq(token.balanceOf(charity),        100e18,                           "charity share");
        assertEq(token.balanceOf(clubWallet),     100e18,                           "club share");
        assertEq(token.balanceOf(house),          100e18,                           "house share");
        assertEq(token.balanceOf(address(voting)), 0,                               "contract empty");
    }

    // ─────────────────────────────────────────────────────────────────────
    // TEST 7: Three NFT mints fire at settlement
    //
    // voter1 is the winner's top voter (and sole voter).
    // houseWallet = house address.
    // Expected: nft.mintCallCount == 3 after settlement.
    // ─────────────────────────────────────────────────────────────────────
    function test_threeNFTMints() public {
        vm.prank(owner);
        voting.setNFTContract(address(nft));

        vm.prank(owner);
        voting.approveProfile("p1", profile1Wallet);

        vm.prank(voter1);
        voting.vote("p1", 100e18);

        vm.warp(block.timestamp + 8 days);
        vm.prank(owner);
        voting.settleRound();

        uint256 reqId = vrf.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 7;
        vm.prank(address(vrf));
        voting.rawFulfillRandomWords(reqId, randomWords);

        assertEq(nft.mintCallCount(), 3, "expected 3 NFT mints");
    }
}
