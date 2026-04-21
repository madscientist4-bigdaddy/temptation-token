// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Deployment sequence (all from deployer wallet):
//   1.  Deploy this contract -> note V3_ADDRESS
//   2.  V3.transferOwnership("0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48")  (immediate, single-step)
//   3.  keeper.setVotingContract("V3_ADDRESS")
//   4.  keeper.manualExecute(1)
//   5.  node scripts/deployV3.js   (prints batchApproveProfiles calldata)
//   6.  V3.batchApproveProfiles(profileIds[], wallets[])
//   7.  Add V3_ADDRESS as consumer at vrf.chain.link
//   8.  Update VOTING_ADDRESS in src/App.jsx
//   9.  npm run build && npx vercel --prod

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IStaking {
    function getStakingTier(address user) external view returns (uint256);
}

// Top-level struct so the coordinator interface can reference it without issues
struct VRFRandomWordsRequest {
    bytes32 keyHash;
    uint256 subId;
    uint16  requestConfirmations;
    uint32  callbackGasLimit;
    uint32  numWords;
    bytes   extraArgs;
}

interface IVRFCoordinatorV2Plus {
    function requestRandomWords(VRFRandomWordsRequest calldata req)
        external returns (uint256 requestId);
}

// -----------------------------------------------------------------------------
// Ownable (single-step, inlined from OpenZeppelin v5.0.0)
// Using single-step Ownable so TTSKeeper2.transferOwnership() works directly —
// Keeper has no acceptOwnership() wrapper, so single-step Ownable is required.
// -----------------------------------------------------------------------------

abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner_);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) { return _owner; }

    function _checkOwner() internal view virtual {
        if (_owner != msg.sender) revert OwnableUnauthorizedAccount(msg.sender);
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address old = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
}

// -----------------------------------------------------------------------------
// VRFConsumerBaseV2Plus (inlined, minimal)
// -----------------------------------------------------------------------------

abstract contract VRFConsumerBaseV2Plus {
    address private immutable i_vrfCoordinator;

    error OnlyCoordinatorCanFulfill(address have, address want);

    constructor(address vrfCoordinator) {
        i_vrfCoordinator = vrfCoordinator;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != i_vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill(msg.sender, i_vrfCoordinator);
        }
        fulfillRandomWords(requestId, randomWords);
    }
}

// -----------------------------------------------------------------------------
// TTSVotingV3
// -----------------------------------------------------------------------------

contract TTSVotingV3 is Ownable, VRFConsumerBaseV2Plus {

    // abi.encode(bytes4(keccak256("VRF ExtraArgsV1")), false) — nativePayment=false
    // bytes4 right-padded to 32 bytes + bool false as 32 bytes = 64 bytes total
    bytes private constant VRF_EXTRA_ARGS = hex"92fd133800000000000000000000000000000000000000000000000000000000"
                                            hex"0000000000000000000000000000000000000000000000000000000000000000";

    // Admin role (deployer): profile approval
    address public admin;

    event AdminTransferred(address indexed previous, address indexed next);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // Config
    IERC20   public immutable ttsToken;
    IStaking public stakingContract;
    address  public charityWallet;
    address  public houseWallet;

    // VRF
    IVRFCoordinatorV2Plus private immutable _coordinator;
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint16  public constant REQUEST_CONFIRMATIONS = 3;
    uint32  public constant NUM_WORDS             = 2;
    uint32  public constant CALLBACK_GAS_LIMIT    = 500000;

    // Voting constants
    uint256 public constant MIN_VOTE         = 5e18;
    uint256 public constant MAX_VOTE_CAP_BPS = 4000;

    // Structs
    struct Profile {
        address wallet;
        uint256 totalTickets;
        uint256 rawVotes;
        address topVoter;
        uint256 topVoterRaw;
        bool    approved;
    }

    struct Round {
        uint256  startTime;
        uint256  endTime;
        uint256  totalTickets;
        uint256  totalRawVotes;
        bool     settled;
        bool     vrfPending;
        string[] profileIds;
    }

    // State
    uint256 public currentRoundId;

    mapping(uint256 => Round)                                          private _rounds;
    mapping(uint256 => mapping(string => Profile))                     private _profiles;
    mapping(uint256 => mapping(string => mapping(address => uint256))) private _voterTotals;
    mapping(uint256 => uint256)                                        private _vrfToRound;

    // Events
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event ProfileApproved(uint256 indexed roundId, string profileId, address wallet);
    event Voted(uint256 indexed roundId, string indexed profileId, address voter, uint256 amount, uint256 tickets);
    event VRFRequested(uint256 indexed roundId, uint256 requestId);
    event RoundSettled(uint256 indexed roundId, string winnerProfileId, address winnerWallet, uint256 pool);

    constructor(
        address _ttsToken,
        address vrfCoordinator_,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        address _stakingContract,
        address _charityWallet,
        address _houseWallet
    )
        Ownable(msg.sender)
        VRFConsumerBaseV2Plus(vrfCoordinator_)
    {
        admin           = msg.sender;
        ttsToken        = IERC20(_ttsToken);
        _coordinator    = IVRFCoordinatorV2Plus(vrfCoordinator_);
        keyHash         = _keyHash;
        subscriptionId  = _subscriptionId;
        stakingContract = IStaking(_stakingContract);
        charityWallet   = _charityWallet;
        houseWallet     = _houseWallet;
    }

    // Profile management (admin)
    function approveProfile(string calldata profileId, address wallet) external onlyAdmin {
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0 && !r.settled, "No active round");
        Profile storage p = _profiles[currentRoundId][profileId];
        require(!p.approved, "Already approved");
        p.approved = true;
        p.wallet   = wallet;
        r.profileIds.push(profileId);
        emit ProfileApproved(currentRoundId, profileId, wallet);
    }

    function batchApproveProfiles(
        string[]  calldata profileIds,
        address[] calldata wallets
    ) external onlyAdmin {
        require(profileIds.length == wallets.length, "Length mismatch");
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0 && !r.settled, "No active round");
        for (uint256 i = 0; i < profileIds.length; i++) {
            Profile storage p = _profiles[currentRoundId][profileIds[i]];
            if (p.approved) continue;
            p.approved = true;
            p.wallet   = wallets[i];
            r.profileIds.push(profileIds[i]);
            emit ProfileApproved(currentRoundId, profileIds[i], wallets[i]);
        }
    }

    // Round management (owner = TTSKeeper2)
    // No-arg overload for TTSKeeper2 compatibility (keeper calls startRound() with no args)
    function startRound() external onlyOwner {
        _startRound(7 days);
    }

    function startRound(uint256 duration) external onlyOwner {
        _startRound(duration);
    }

    function _startRound(uint256 duration) internal {
        if (currentRoundId > 0) {
            require(_rounds[currentRoundId].settled, "Previous round not settled");
        }
        currentRoundId++;
        Round storage r = _rounds[currentRoundId];
        r.startTime = block.timestamp;
        r.endTime   = block.timestamp + duration;
        emit RoundStarted(currentRoundId, r.startTime, r.endTime);
    }

    function midpointSnapshot() external onlyOwner {}

    function settleRound() external onlyOwner {
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0, "Round not started");
        require(!r.settled, "Already settled");
        require(!r.vrfPending, "VRF pending");
        require(block.timestamp >= r.endTime, "Round not ended");
        require(r.profileIds.length > 0, "No profiles");

        r.vrfPending = true;

        VRFRandomWordsRequest memory req;
        req.keyHash              = keyHash;
        req.subId                = subscriptionId;
        req.requestConfirmations = REQUEST_CONFIRMATIONS;
        req.callbackGasLimit     = CALLBACK_GAS_LIMIT;
        req.numWords             = NUM_WORDS;
        req.extraArgs            = VRF_EXTRA_ARGS;

        uint256 requestId = _coordinator.requestRandomWords(req);
        _vrfToRound[requestId] = currentRoundId;
        emit VRFRequested(currentRoundId, requestId);
    }

    // VRF callback
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 roundId = _vrfToRound[requestId];
        Round storage r = _rounds[roundId];
        require(r.vrfPending, "Not VRF pending");
        r.vrfPending = false;
        r.settled    = true;

        if (r.profileIds.length == 0 || r.totalTickets == 0) return;

        uint256 pick = randomWords[0] % r.totalTickets;
        uint256 cum  = 0;
        string memory winnerId;
        for (uint256 i = 0; i < r.profileIds.length; i++) {
            cum += _profiles[roundId][r.profileIds[i]].totalTickets;
            if (pick < cum) {
                winnerId = r.profileIds[i];
                break;
            }
        }

        Profile storage winner = _profiles[roundId][winnerId];
        uint256 pool = winner.rawVotes;
        if (pool == 0 || winner.wallet == address(0)) return;

        uint256 profileShare = pool * 40 / 100;
        uint256 voterShare   = pool * 40 / 100;
        uint256 charityShare = pool * 10 / 100;
        uint256 houseShare   = pool - profileShare - voterShare - charityShare;

        ttsToken.transfer(winner.wallet, profileShare);
        ttsToken.transfer(
            winner.topVoter != address(0) ? winner.topVoter : winner.wallet,
            voterShare
        );
        ttsToken.transfer(charityWallet, charityShare);
        ttsToken.transfer(houseWallet, houseShare);

        uint256 remaining = ttsToken.balanceOf(address(this));
        if (remaining > 0) {
            ttsToken.transfer(0x000000000000000000000000000000000000dEaD, remaining);
        }

        emit RoundSettled(roundId, winnerId, winner.wallet, pool);
    }

    // Voting
    function vote(string calldata profileId, uint256 amount) external {
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0 && !r.settled, "No active round");
        require(block.timestamp >= r.startTime && block.timestamp <= r.endTime, "Round not active");
        require(amount >= MIN_VOTE, "Below minimum");

        Profile storage p = _profiles[currentRoundId][profileId];
        require(p.approved, "Profile not approved");

        uint256 newProfileRaw = p.rawVotes + amount;
        uint256 newRoundRaw   = r.totalRawVotes + amount;
        require(r.totalRawVotes == 0 || newProfileRaw * 10000 <= newRoundRaw * MAX_VOTE_CAP_BPS, "Exceeds vote cap");

        require(ttsToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 tickets = _applyMultiplier(msg.sender, amount);

        p.rawVotes      += amount;
        p.totalTickets  += tickets;
        r.totalRawVotes += amount;
        r.totalTickets  += tickets;

        _voterTotals[currentRoundId][profileId][msg.sender] += amount;
        uint256 voterTotal = _voterTotals[currentRoundId][profileId][msg.sender];
        if (voterTotal > p.topVoterRaw) {
            p.topVoterRaw = voterTotal;
            p.topVoter    = msg.sender;
        }

        emit Voted(currentRoundId, profileId, msg.sender, amount, tickets);
    }

    // View functions
    function getRound(uint256 roundId) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 totalTickets,
        uint256 totalRawVotes,
        bool    settled,
        bool    vrfPending,
        uint256 profileCount
    ) {
        Round storage r = _rounds[roundId];
        return (r.startTime, r.endTime, r.totalTickets, r.totalRawVotes,
                r.settled, r.vrfPending, r.profileIds.length);
    }

    function getProfile(uint256 roundId, string calldata profileId) external view returns (
        address wallet,
        uint256 totalTickets,
        uint256 rawVotes,
        address topVoter,
        bool    approved
    ) {
        Profile storage p = _profiles[roundId][profileId];
        return (p.wallet, p.totalTickets, p.rawVotes, p.topVoter, p.approved);
    }

    function getVoterAmount(
        uint256 roundId,
        string calldata profileId,
        address voter
    ) external view returns (uint256) {
        return _voterTotals[roundId][profileId][voter];
    }

    // Admin setters
    function setCharityWallet(address _charity) external onlyAdmin {
        require(_charity != address(0), "Zero address");
        charityWallet = _charity;
    }

    function setHouseWallet(address _house) external onlyAdmin {
        require(_house != address(0), "Zero address");
        houseWallet = _house;
    }

    function setStakingContract(address _staking) external onlyAdmin {
        stakingContract = IStaking(_staking);
    }

    // Internal
    function _applyMultiplier(address voter, uint256 amount) internal view returns (uint256) {
        try stakingContract.getStakingTier(voter) returns (uint256 tier) {
            if (tier == 5) return amount * 300 / 100;
            if (tier == 4) return amount * 200 / 100;
            if (tier == 3) return amount * 175 / 100;
            if (tier == 2) return amount * 150 / 100;
            if (tier == 1) return amount * 125 / 100;
            if (tier == 0) return amount * 110 / 100;
        } catch {}
        return amount;
    }
}
