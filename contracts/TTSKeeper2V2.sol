// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// TTSKeeper2V2 — Chainlink Automation keeper for TTSVotingV3c
//
// Fixes from TTSKeeper2 (V1):
//   CRITICAL  checkUpkeep was absent from bytecode — Chainlink could not detect triggers
//   CRITICAL  s_forwarder pointed to Ethereum mainnet Registrar (no code on Base)
//   HIGH      performUpkeep lacked forwarder-check; any EOA could call it
//   HIGH      No AutomationCompatibleInterface implementation
//
// Architecture:
//   - Implements AutomationCompatibleInterface (checkUpkeep + performUpkeep)
//   - performUpkeep gated to forwarder address (set by owner after Chainlink registration)
//   - manualExecute(uint256) allows owner to trigger any action without Chainlink
//   - setForwarder(address) called once after upkeep registration, with forwarder from UI
//   - ROUND_DURATION = 604740 (7 days − 60s): aligns endTime with 03:59 UTC Monday
//     when round is started at 04:00 UTC Monday
//
// Deployment sequence:
//   1. Deploy TTSVotingV3c → V3c_ADDRESS
//   2. Deploy TTSKeeper2V2(V3c_ADDRESS) → KEEPER_ADDRESS
//   3. V3c.transferOwnership(KEEPER_ADDRESS) from Bank wallet
//   4. Register Custom Logic upkeep on automation.chain.link/base → note Forwarder address
//   5. KEEPER.setForwarder(FORWARDER_ADDRESS) from Bank wallet
//   6. V3c as VRF consumer at vrf.chain.link/base (same subscription as V3b)
//   7. Fund upkeep with 5 LINK

// ─── Interfaces ───────────────────────────────────────────────────────────────

// Inline AutomationCompatibleInterface (matches Chainlink's published interface exactly)
interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

interface IVotingV3c {
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
    function startRound(uint256 duration)    external;
    function settleRound()                   external;
    function rolloverRound()                 external;
    function takeMidpointSnapshot()          external;
}

// ─── Ownable (inline, identical to V3b/V3c) ──────────────────────────────────

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

// ─── TTSKeeper2V2 ─────────────────────────────────────────────────────────────

contract TTSKeeper2V2 is Ownable, AutomationCompatibleInterface {

    // ── Actions ───────────────────────────────────────────────────────────────
    uint256 public constant ACTION_START_ROUND = 1;
    uint256 public constant ACTION_SNAPSHOT    = 2;
    uint256 public constant ACTION_SETTLE      = 3;
    uint256 public constant ACTION_ROLLOVER    = 4;

    // 7 days − 60 seconds: if started at 04:00 UTC Monday, endTime = 03:59 UTC next Monday
    uint256 public constant ROUND_DURATION = 604740;

    // ── State ─────────────────────────────────────────────────────────────────
    IVotingV3c public votingContract;

    // Assigned by Chainlink after upkeep registration.
    // Until set, only owner can call performUpkeep.
    // Set once via setForwarder() after registration.
    address public s_forwarder;

    // ── Events ────────────────────────────────────────────────────────────────
    event ForwarderSet(address indexed previous, address indexed next);
    event VotingContractSet(address indexed previous, address indexed next);
    event UpkeepPerformed(uint256 indexed action, bool success);
    event ManualExecuted(uint256 indexed action, bool success);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _votingContract) Ownable(msg.sender) {
        require(_votingContract != address(0), "Zero voting contract");
        votingContract = IVotingV3c(_votingContract);
    }

    // ── Admin setters ─────────────────────────────────────────────────────────

    /// @notice Called once after Chainlink upkeep registration with the forwarder address shown in the UI.
    function setForwarder(address _forwarder) external onlyOwner {
        emit ForwarderSet(s_forwarder, _forwarder);
        s_forwarder = _forwarder;
    }

    /// @notice Update the voting contract (e.g. V3c → V3d in future).
    function setVotingContract(address _voting) external onlyOwner {
        require(_voting != address(0), "Zero address");
        emit VotingContractSet(address(votingContract), _voting);
        votingContract = IVotingV3c(_voting);
    }

    // ── AutomationCompatibleInterface ─────────────────────────────────────────

    /// @notice Called by Chainlink off-chain to determine if an upkeep is needed.
    /// Returns (true, performData) when a round action is due.
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

        // No round started yet → start first round
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
            // Round ended, not yet settled, VRF not in flight → trigger settlement
            if (startTime > 0 && !settled && !vrfPending && block.timestamp >= endTime) {
                if (profileCount > 0) {
                    return (true, abi.encode(ACTION_SETTLE));
                } else {
                    // Zero-profile round: rollover (settleRound would revert without profiles)
                    return (true, abi.encode(ACTION_ROLLOVER));
                }
            }

            // Round settled (VRF complete) → start next round immediately
            if (settled) {
                return (true, abi.encode(ACTION_START_ROUND));
            }
        } catch {
            return (false, "");
        }

        return (false, "");
    }

    /// @notice Called by Chainlink on-chain when checkUpkeep returns true.
    /// msg.sender must be the registered forwarder (or owner for manual override).
    function performUpkeep(bytes calldata performData) external override {
        require(
            msg.sender == s_forwarder || msg.sender == owner(),
            "TTSKeeper2V2: not forwarder"
        );
        uint256 action = abi.decode(performData, (uint256));
        bool ok = _execute(action);
        emit UpkeepPerformed(action, ok);
    }

    // ── Manual execution (owner-only, emergency / recovery path) ─────────────

    /// @notice Directly trigger an action from the owner wallet.
    /// @param action 1=startRound 2=snapshot 3=settle 4=rollover
    function manualExecute(uint256 action) external onlyOwner {
        bool ok = _execute(action);
        emit ManualExecuted(action, ok);
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /// @return The Unix timestamp at which the current round can be settled.
    ///         Returns 0 if no active round or round already settled.
    function getNextSettlementTime() external view returns (uint256) {
        try votingContract.currentRoundId() returns (uint256 roundId) {
            if (roundId == 0) return 0;
            try votingContract.getRound(roundId) returns (
                uint256, // startTime
                uint256 endTime,
                uint256, uint256,
                bool settled,
                bool vrfPending,
                uint256
            ) {
                return (settled || vrfPending) ? 0 : endTime;
            } catch {}
        } catch {}
        return 0;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _execute(uint256 action) internal returns (bool success) {
        if (action == ACTION_START_ROUND) {
            try votingContract.startRound(ROUND_DURATION) {
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
        if (action == ACTION_SNAPSHOT) {
            try votingContract.takeMidpointSnapshot() {
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
