// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// contracts/TTSKeeper3.sol

// TTSKeeper3 — Calendar-pinned Chainlink Automation keeper for TTSVotingV3d
//
// Key difference from TTSKeeper2V2:
//   Each round ends EXACTLY on a calendar-anchored Monday 04:59:00 UTC.
//   s_nextSettleTarget holds the endTime for the CURRENT running round.
//   When a round starts, duration = s_nextSettleTarget - block.timestamp, so
//   endTime == s_nextSettleTarget regardless of when the keeper fires.
//   After startRound, s_nextSettleTarget += WEEK, pointing to the next Monday.
//   Zero drift accrues: no "now + duration" rounding.
//
// UTC-5 fixed (no DST): Monday 04:59:00 UTC = Sunday 23:59:00 EST.
//
// Compile: Solidity 0.8.20, optimizer 200, evmVersion paris, viaIR=false.

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

interface IVotingV3d {
    function currentRoundId() external view returns (uint256);
    function getRound(uint256 roundId) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 totalTickets,
        uint256 totalRawVotes,
        bool    settled,
        bool    vrfPending,
        uint256 profileCount
    );
    function startRound(uint256 duration) external;
    function settleRound()                external;
    function rolloverRound()              external;
    function takeMidpointSnapshot()       external;
}

// ─── OwnableKeeper (inline, identical logic to V3b/V3c/V3d Ownable) ──────────
// Named differently to avoid symbol clash when imported alongside TTSVotingV3d.

abstract contract OwnableKeeper {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner_);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        if (_owner != msg.sender) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    function owner() public view returns (address) { return _owner; }

    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal {
        address old = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    function renounceOwnership() public onlyOwner {
        _transferOwnership(address(0));
    }
}

// ─── TTSKeeper3 ───────────────────────────────────────────────────────────────

contract TTSKeeper3 is OwnableKeeper, AutomationCompatibleInterface {

    // ── Actions ───────────────────────────────────────────────────────────────
    uint256 public constant ACTION_START_ROUND = 1;
    uint256 public constant ACTION_SETTLE      = 3;
    uint256 public constant ACTION_ROLLOVER    = 4;

    uint256 public constant WEEK = 604800;

    // ── State ─────────────────────────────────────────────────────────────────
    IVotingV3d public votingContract;

    // Chainlink forwarder assigned after upkeep registration.
    // Until set, only owner may call performUpkeep.
    address public s_forwarder;

    // Next calendar-pinned Monday 04:59:00 UTC timestamp.
    // This equals the endTime of the current running round.
    // Advances by WEEK each time a round is started.
    uint256 public s_nextSettleTarget;

    // ── Events ────────────────────────────────────────────────────────────────
    event ForwarderSet(address indexed previous, address indexed next);
    event VotingContractSet(address indexed previous, address indexed next);
    event UpkeepPerformed(uint256 indexed action, bool success);
    event ManualExecuted(uint256 indexed action, bool success);
    event ScheduleReset(uint256 indexed newTarget);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _votingContract, uint256 _nextSettleTarget) OwnableKeeper(msg.sender) {
        require(_votingContract   != address(0), "Zero voting contract");
        require(_nextSettleTarget >  block.timestamp, "Target must be in future");
        votingContract     = IVotingV3d(_votingContract);
        s_nextSettleTarget = _nextSettleTarget;
    }

    // ── Admin setters ─────────────────────────────────────────────────────────

    function setForwarder(address _forwarder) external onlyOwner {
        emit ForwarderSet(s_forwarder, _forwarder);
        s_forwarder = _forwarder;
    }

    function setVotingContract(address _voting) external onlyOwner {
        require(_voting != address(0), "Zero address");
        emit VotingContractSet(address(votingContract), _voting);
        votingContract = IVotingV3d(_voting);
    }

    // Emergency calendar override — owner only.
    function resetSchedule(uint256 newTarget) external onlyOwner {
        require(newTarget > block.timestamp, "Must be in future");
        s_nextSettleTarget = newTarget;
        emit ScheduleReset(newTarget);
    }

    // ── AutomationCompatibleInterface ─────────────────────────────────────────

    /// @notice Called by Chainlink off-chain every block to detect needed work.
    function checkUpkeep(bytes calldata)
        external view override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 roundId;
        try votingContract.currentRoundId() returns (uint256 id) {
            roundId = id;
        } catch {
            return (false, "");
        }

        // No round has ever started → start the first one.
        if (roundId == 0) {
            return (true, abi.encode(ACTION_START_ROUND));
        }

        try votingContract.getRound(roundId) returns (
            uint256 startTime,
            uint256 endTime,
            uint256, // totalTickets
            uint256, // totalRawVotes
            bool settled,
            bool vrfPending,
            uint256 profileCount
        ) {
            // Round is settled (VRF fulfilled or rollover) → start the next one.
            if (settled) {
                return (true, abi.encode(ACTION_START_ROUND));
            }

            // Round is live, its calendar endTime has passed, VRF not in flight.
            // endTime was set to s_nextSettleTarget at round-start time, so this
            // is equivalent to checking block.timestamp >= that calendar target.
            if (startTime > 0 && !vrfPending && block.timestamp >= endTime) {
                if (profileCount > 0) {
                    return (true, abi.encode(ACTION_SETTLE));
                } else {
                    return (true, abi.encode(ACTION_ROLLOVER));
                }
            }
        } catch {
            return (false, "");
        }

        return (false, "");
    }

    /// @notice Called by Chainlink on-chain when checkUpkeep returns true.
    function performUpkeep(bytes calldata performData) external override {
        require(
            msg.sender == s_forwarder || msg.sender == owner(),
            "TTSKeeper3: not forwarder"
        );
        uint256 action = abi.decode(performData, (uint256));
        bool ok = _execute(action);
        emit UpkeepPerformed(action, ok);
    }

    // ── Manual execution (owner-only emergency / recovery path) ──────────────

    function manualExecute(uint256 action) external onlyOwner {
        bool ok = _execute(action);
        emit ManualExecuted(action, ok);
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    function getNextSettlementTime() external view returns (uint256) {
        try votingContract.currentRoundId() returns (uint256 roundId) {
            if (roundId == 0) return 0;
            try votingContract.getRound(roundId) returns (
                uint256, uint256 endTime, uint256, uint256,
                bool settled, bool vrfPending, uint256
            ) {
                return (settled || vrfPending) ? 0 : endTime;
            } catch {}
        } catch {}
        return 0;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _execute(uint256 action) internal returns (bool success) {
        if (action == ACTION_START_ROUND) {
            // Advance s_nextSettleTarget past now if it has already passed
            // (handles late fires, very first start, or post-rollover restarts).
            while (s_nextSettleTarget <= block.timestamp) {
                s_nextSettleTarget += WEEK;
            }
            // duration is chosen so endTime = block.timestamp + duration = s_nextSettleTarget.
            uint256 duration = s_nextSettleTarget - block.timestamp;
            try votingContract.startRound(duration) {
                // Advance to the next calendar Monday — the endTime for the round after this.
                s_nextSettleTarget += WEEK;
                return true;
            } catch {
                return false;
            }
        }

        if (action == ACTION_SETTLE) {
            try votingContract.settleRound() {
                return true;
            } catch {
                return false;
            }
        }

        if (action == ACTION_ROLLOVER) {
            try votingContract.rolloverRound() {
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }
}
