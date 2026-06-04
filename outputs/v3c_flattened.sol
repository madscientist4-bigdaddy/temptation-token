// SPDX-License-Identifier: MIT
// Compile in Remix: Solidity 0.8.20, optimizer 200, via IR ENABLED
pragma solidity ^0.8.20;

// contracts/TTSVotingV3c.sol

// TTSVotingV3c — Upgraded from V3b
//
// Changes from V3b:
//   MULTIPLIERS   tier 3 (Diamond): 1.75x → 2.0x
//                 tier 4 (VIP):     2.0x  → 3.0x
//                 tier 5 (ghost):   removed entirely
//   NFT MINTS     Settlement now mints 3 NFTs: winning profile, top voter, BE LLC archive (houseWallet)
//   VOTE CAPS     Per-tier single-tx vote cap: Unstaked 500, Bronze 1000, Silver 2500,
//                 Gold 5000, Diamond 15000, VIP unlimited
//                 New public view: tierVoteCap(address voter) for frontend queries
//
// All V3b fixes retained (security, VRF gas limit, SafeERC20, etc.)
//
// Canonical prize split (unchanged):
//   No club:   35% top voter / 35% winning profile / 10% charity / 20% house
//   With club: 35% top voter / 35% winning profile / 10% charity / 10% club / 10% house
//
// Storage layout: slots 0-12 identical to V3b (no new state variables)
//
// Deployment sequence — see outputs/v3c_v2_deployment_runbook.md for full detail:
//   1.  Deploy TTSVotingV3c               → V3c_ADDRESS
//   2.  Deploy TTSKeeper2V2(V3c_ADDRESS)  → KEEPER_ADDRESS
//   3.  V3c.transferOwnership(KEEPER_ADDRESS)
//   4.  V3c.setNFTContract("0x0768e862D3AB14d85213BfeF8f1D012E77721da2")
//   5.  Add V3c_ADDRESS as VRF consumer at vrf.chain.link/base
//   6.  Register Custom Logic upkeep at automation.chain.link/base → FORWARDER_ADDRESS
//   7.  KEEPER.setForwarder(FORWARDER_ADDRESS)
//   8.  Gnosis Safe: setTaxExempt(V3c_ADDRESS, true)
//   9.  KEEPER.manualExecute(1) → starts Round 2
//   10. V3c.batchApproveProfiles(profileIds[], wallets[])
//   11. Update VOTING_ADDRESS in src/App.jsx + admin dashboard + api routes
//   12. npm run build && npx vercel --prod

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

interface ITTSRoundNFT {
    function mint(address to, uint256 roundId, string calldata winnerProfile, uint256 voteCount) external;
}

// -----------------------------------------------------------------------------
// SafeERC20 — handles tokens that don't return bool
// -----------------------------------------------------------------------------

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: call failed");
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "SafeERC20: transfer failed");
        }
    }
}

// -----------------------------------------------------------------------------
// Ownable (single-step — TTSKeeper2 uses single-step transferOwnership)
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
// TTSVotingV3c
// -----------------------------------------------------------------------------

contract TTSVotingV3c is Ownable, VRFConsumerBaseV2Plus {
    using SafeERC20 for IERC20;

    bytes private constant VRF_EXTRA_ARGS = hex"92fd133800000000000000000000000000000000000000000000000000000000"
                                            hex"0000000000000000000000000000000000000000000000000000000000000000";

    // Admin role (deployer): profile approval, club management
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
    address  public nftContract;

    // VRF
    IVRFCoordinatorV2Plus private immutable _coordinator;
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint16  public constant REQUEST_CONFIRMATIONS  = 3;
    uint32  public constant NUM_WORDS              = 2;
    uint32  public constant CALLBACK_GAS_LIMIT     = 2500000;

    // Voting constants
    uint256 public constant MIN_VOTE              = 5e18;
    uint256 public constant MAX_VOTE_CAP_BPS      = 4000;
    uint256 public constant MAX_PROFILES_PER_ROUND = 50;

    // V3c: per-tier single-tx vote caps (tier 5 VIP = unlimited, no constant needed)
    uint256 public constant VOTE_CAP_UNSTAKED = 500e18;
    uint256 public constant VOTE_CAP_BRONZE   = 1000e18;
    uint256 public constant VOTE_CAP_SILVER   = 2500e18;
    uint256 public constant VOTE_CAP_GOLD     = 5000e18;
    uint256 public constant VOTE_CAP_DIAMOND  = 15000e18;

    // ── Club referral mappings ────────────────────────────────────────────────
    mapping(string => address) public clubWallets;
    mapping(string => string)  public profileClub;

    event ClubWalletSet(string indexed clubCode, address indexed wallet);
    event ProfileClubSet(string indexed profileId, string indexed clubCode);
    event ClubPayoutSent(uint256 indexed roundId, string clubCode, address indexed clubWallet, uint256 amount);

    event CharityWalletUpdated(address indexed previous, address indexed next);
    event HouseWalletUpdated(address indexed previous, address indexed next);
    event NFTContractUpdated(address indexed previous, address indexed next);

    event MultiplierFallback(address indexed voter);

    function setClubWallet(string calldata code, address wallet) external onlyAdmin {
        clubWallets[code] = wallet;
        emit ClubWalletSet(code, wallet);
    }

    function setProfileClub(string calldata profileId, string calldata clubCode) external onlyAdmin {
        profileClub[profileId] = clubCode;
        emit ProfileClubSet(profileId, clubCode);
    }

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

    mapping(uint256 => Round)                                          internal _rounds;
    mapping(uint256 => mapping(string => Profile))                     private  _profiles;
    mapping(uint256 => mapping(string => mapping(address => uint256))) private  _voterTotals;
    mapping(uint256 => uint256)                                        private  _vrfToRound;

    // Events
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event ProfileApproved(uint256 indexed roundId, string profileId, address wallet);
    event Voted(uint256 indexed roundId, string indexed profileId, address voter, uint256 amount, uint256 tickets);
    event VRFRequested(uint256 indexed roundId, uint256 requestId);
    event RoundSettled(uint256 indexed roundId, string winnerProfileId, address winnerWallet, uint256 pool);
    event RoundRolledOver(uint256 indexed roundId);

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
        require(_ttsToken       != address(0), "Zero token");
        require(_charityWallet  != address(0), "Zero charity");
        require(_houseWallet    != address(0), "Zero house");

        admin           = msg.sender;
        ttsToken        = IERC20(_ttsToken);
        _coordinator    = IVRFCoordinatorV2Plus(vrfCoordinator_);
        keyHash         = _keyHash;
        subscriptionId  = _subscriptionId;
        stakingContract = IStaking(_stakingContract);
        charityWallet   = _charityWallet;
        houseWallet     = _houseWallet;
    }

    // -------------------------------------------------------------------------
    // Keeper compatibility wrappers
    // -------------------------------------------------------------------------

    function minProfilesPerRound() external pure returns (uint256) {
        return 1;
    }

    function getProfiles(uint256 roundId) external view returns (string[] memory) {
        return _rounds[roundId].profileIds;
    }

    function requestSettlement() external onlyOwner {
        _requestSettlement();
    }

    function rolloverRound() external onlyOwner {
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0, "Round not started");
        require(!r.settled, "Already settled");
        require(!r.vrfPending, "VRF pending");
        require(block.timestamp >= r.endTime, "Round still active");
        r.settled = true;
        emit RoundRolledOver(currentRoundId);
    }

    function takeMidpointSnapshot() external onlyOwner {
        // no-op, kept for compatibility
    }

    // -------------------------------------------------------------------------
    // Profile management (admin)
    // -------------------------------------------------------------------------

    function approveProfile(string calldata profileId, address wallet) external onlyAdmin {
        require(wallet != address(0), "Zero wallet");
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0 && !r.settled, "No active round");
        require(r.profileIds.length < MAX_PROFILES_PER_ROUND, "Profile cap reached");
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
            require(wallets[i] != address(0), "Zero wallet");
            require(r.profileIds.length < MAX_PROFILES_PER_ROUND, "Profile cap reached");
            Profile storage p = _profiles[currentRoundId][profileIds[i]];
            if (p.approved) continue;
            p.approved = true;
            p.wallet   = wallets[i];
            r.profileIds.push(profileIds[i]);
            emit ProfileApproved(currentRoundId, profileIds[i], wallets[i]);
        }
    }

    // -------------------------------------------------------------------------
    // Round management (owner = TTSKeeper2)
    // -------------------------------------------------------------------------

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
        _requestSettlement();
    }

    function _requestSettlement() internal {
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

    function adminResetSettlement(uint256 roundId) external onlyOwner {
        Round storage r = _rounds[roundId];
        require(r.vrfPending, "No pending VRF");
        require(block.timestamp > r.endTime + 1 days, "Too early");
        r.vrfPending = false;
    }

    // -------------------------------------------------------------------------
    // VRF callback
    // -------------------------------------------------------------------------

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
        if (winner.rawVotes == 0 || winner.wallet == address(0)) return;
        _distributePayouts(roundId, winnerId, winner);
    }

    // Extracted from fulfillRandomWords to stay within Solidity's 16-slot stack limit.
    function _distributePayouts(uint256 roundId, string memory winnerId, Profile storage winner) private {
        uint256 pool = winner.rawVotes;
        uint256 profileShare = pool * 35 / 100;
        uint256 voterShare   = pool * 35 / 100;
        uint256 charityShare = pool * 10 / 100;

        string memory clubCode = profileClub[winnerId];
        address clubWallet = bytes(clubCode).length > 0 ? clubWallets[clubCode] : address(0);

        uint256 clubShare  = 0;
        uint256 houseShare;
        if (clubWallet != address(0)) {
            clubShare  = pool * 10 / 100;
            houseShare = pool - profileShare - voterShare - charityShare - clubShare;
        } else {
            houseShare = pool - profileShare - voterShare - charityShare;
        }

        address topVoterAddr = winner.topVoter != address(0) ? winner.topVoter : winner.wallet;

        ttsToken.safeTransfer(winner.wallet, profileShare);
        ttsToken.safeTransfer(topVoterAddr, voterShare);
        ttsToken.safeTransfer(charityWallet, charityShare);
        ttsToken.safeTransfer(houseWallet, houseShare);

        if (clubShare > 0) {
            ttsToken.safeTransfer(clubWallet, clubShare);
            emit ClubPayoutSent(roundId, clubCode, clubWallet, clubShare);
        }

        // V3c: three NFT mints — winning profile, top voter, BE LLC archive (houseWallet)
        if (nftContract != address(0)) {
            uint256 voteCount = pool / 1e18;
            try ITTSRoundNFT(nftContract).mint{gas: 200000}(winner.wallet, roundId, winnerId, voteCount) {} catch {}
            try ITTSRoundNFT(nftContract).mint{gas: 200000}(topVoterAddr, roundId, winnerId, voteCount) {} catch {}
            try ITTSRoundNFT(nftContract).mint{gas: 200000}(houseWallet, roundId, winnerId, voteCount) {} catch {}
        }

        uint256 remaining = ttsToken.balanceOf(address(this));
        if (remaining > 0) {
            ttsToken.safeTransfer(0x000000000000000000000000000000000000dEaD, remaining);
        }

        emit RoundSettled(roundId, winnerId, winner.wallet, pool);
    }

    // -------------------------------------------------------------------------
    // Voting
    // -------------------------------------------------------------------------

    function vote(string calldata profileId, uint256 amount) external {
        Round storage r = _rounds[currentRoundId];
        require(r.startTime > 0 && !r.settled, "No active round");
        require(block.timestamp >= r.startTime && block.timestamp <= r.endTime, "Round not active");
        require(amount >= MIN_VOTE, "Below minimum");

        // V3c: per-tier single-tx vote cap
        require(amount <= tierVoteCap(msg.sender), "Exceeds tier vote cap");

        Profile storage p = _profiles[currentRoundId][profileId];
        require(p.approved, "Profile not approved");

        uint256 newProfileRaw = p.rawVotes + amount;
        uint256 newRoundRaw   = r.totalRawVotes + amount;

        if (newRoundRaw > newProfileRaw) {
            require(newProfileRaw * 10000 <= newRoundRaw * MAX_VOTE_CAP_BPS, "Exceeds vote cap");
        }

        ttsToken.safeTransferFrom(msg.sender, address(this), amount);

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

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

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

    // V3c: returns per-tier single-tx vote cap for a given voter address.
    // getStakingTier() reverts for unstaked addresses — catch covers that case.
    // Tier numbering from TTSStakingV2: 0=Bronze, 1=Silver, 2=Gold, 3=Diamond, 4=VIP.
    function tierVoteCap(address voter) public view returns (uint256) {
        try stakingContract.getStakingTier(voter) returns (uint256 tier) {
            if (tier == 0) return VOTE_CAP_BRONZE;
            if (tier == 1) return VOTE_CAP_SILVER;
            if (tier == 2) return VOTE_CAP_GOLD;
            if (tier == 3) return VOTE_CAP_DIAMOND;
            return type(uint256).max; // tier == 4 (VIP): no cap
        } catch {}
        return VOTE_CAP_UNSTAKED; // reverts for unstaked/uninitialized: treat as unstaked
    }

    // -------------------------------------------------------------------------
    // Admin setters
    // -------------------------------------------------------------------------

    function setCharityWallet(address _charity) external onlyAdmin {
        require(_charity != address(0), "Zero address");
        emit CharityWalletUpdated(charityWallet, _charity);
        charityWallet = _charity;
    }

    function setHouseWallet(address _house) external onlyAdmin {
        require(_house != address(0), "Zero address");
        emit HouseWalletUpdated(houseWallet, _house);
        houseWallet = _house;
    }

    function setStakingContract(address _staking) external onlyAdmin {
        stakingContract = IStaking(_staking);
    }

    function setNFTContract(address _nft) external onlyAdmin {
        emit NFTContractUpdated(nftContract, _nft);
        nftContract = _nft;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    // V3c multipliers: Diamond (tier 3) 2x, VIP (tier 4) 3x, ghost tier 5 removed
    function _applyMultiplier(address voter, uint256 amount) internal returns (uint256) {
        try stakingContract.getStakingTier(voter) returns (uint256 tier) {
            if (tier == 4) return amount * 300 / 100;
            if (tier == 3) return amount * 200 / 100;
            if (tier == 2) return amount * 150 / 100;
            if (tier == 1) return amount * 125 / 100;
            if (tier == 0) return amount * 110 / 100;
        } catch {
            emit MultiplierFallback(voter);
        }
        return amount;
    }
}
