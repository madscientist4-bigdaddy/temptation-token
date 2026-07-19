// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/TTSStaking.sol";

/**
 * @notice Minimal ERC1967-slot-compatible proxy for tests (pragma 0.8.20).
 * The repo's bundled OZ core is v5.6.1 (ERC1967Proxy needs ^0.8.22), which
 * clashes with our 0.8.20 pin, so we use this. It writes/reads the canonical
 * ERC1967 implementation slot, so UUPSUpgradeable.upgradeTo works unchanged.
 */
contract TestProxy {
    // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 internal constant _IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address impl, bytes memory initData) {
        assembly { sstore(_IMPL_SLOT, impl) }
        (bool ok, bytes memory ret) = impl.delegatecall(initData);
        if (!ok) {
            assembly { revert(add(ret, 0x20), mload(ret)) }
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(_IMPL_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}

/**
 * @notice Mock TTS mirroring mainnet behaviour: 1% transfer tax, with an
 * isTaxExempt allowlist that zeroes the tax when EITHER party is exempt
 * (matches the real token). Lets us prove staking accounting under tax.
 */
contract MockTTSTax {
    string  public name = "Mock TTS";
    string  public symbol = "TTS";
    uint8   public constant decimals = 18;
    uint256 public totalSupply;
    uint256 public taxBps = 100; // 1%
    address public treasury;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isTaxExempt;

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function setTaxExempt(address a, bool v) external { isTaxExempt[a] = v; }
    function setTaxBps(uint256 b) external { taxBps = b; }

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
        totalSupply += amt;
    }

    function approve(address spender, uint256 amt) external returns (bool) {
        allowance[msg.sender][spender] = amt;
        return true;
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        _transfer(msg.sender, to, amt);
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amt, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amt;
        _transfer(from, to, amt);
        return true;
    }

    function _transfer(address from, address to, uint256 amt) internal {
        require(balanceOf[from] >= amt, "insufficient");
        balanceOf[from] -= amt;
        uint256 tax = (isTaxExempt[from] || isTaxExempt[to]) ? 0 : (amt * taxBps) / 10_000;
        balanceOf[to] += (amt - tax);
        if (tax > 0) balanceOf[treasury] += tax;
    }
}

/**
 * @notice Byte-for-byte replica of TTSVotingV3d's staking read logic
 * (_applyMultiplier + tierVoteCap), so the suite proves the integration seam
 * without pulling in the whole voting contract. Gate D swaps this for real V3d.
 */
interface IStakingTier {
    function getStakingTier(address user) external view returns (uint256);
}

contract StubVotingV3d {
    IStakingTier public staking;

    // V3d per-tier single-tx caps (18-dec). Unstaked 500 / Bronze 1000 /
    // Silver 2500 / Gold 5000 / Diamond 15000 / VIP unlimited.
    uint256 constant CAP_UNSTAKED = 500e18;
    uint256 constant CAP_BRONZE   = 1000e18;
    uint256 constant CAP_SILVER   = 2500e18;
    uint256 constant CAP_GOLD     = 5000e18;
    uint256 constant CAP_DIAMOND  = 15000e18;

    constructor(address _staking) { staking = IStakingTier(_staking); }

    function multiplierApplied(address voter, uint256 amount) external view returns (uint256) {
        try staking.getStakingTier(voter) returns (uint256 tier) {
            if (tier == 4) return amount * 300 / 100;
            if (tier == 3) return amount * 200 / 100;
            if (tier == 2) return amount * 150 / 100;
            if (tier == 1) return amount * 125 / 100;
            if (tier == 0) return amount * 110 / 100;
        } catch {}
        return amount;
    }

    function tierVoteCap(address voter) external view returns (uint256) {
        try staking.getStakingTier(voter) returns (uint256 tier) {
            if (tier == 0) return CAP_BRONZE;
            if (tier == 1) return CAP_SILVER;
            if (tier == 2) return CAP_GOLD;
            if (tier == 3) return CAP_DIAMOND;
            return type(uint256).max;
        } catch {}
        return CAP_UNSTAKED;
    }
}

/**
 * @notice Malicious token used as the staking contract's ttsToken to attempt a
 * reentrant call back into stake/unstake/claim during a transfer. Proves the
 * nonReentrant guard holds even against a hostile token implementation.
 */
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public target;      // the staking contract
    uint8   public mode;        // 0 none, 1 stake, 2 unstake, 3 claim, 4 emergency
    bool    public armed;

    function mint(address to, uint256 amt) external { balanceOf[to] += amt; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function setAttack(address _target, uint8 _mode) external { target = _target; mode = _mode; armed = true; }

    function _maybeReenter() internal {
        if (!armed) return;
        armed = false; // one shot
        if (mode == 1) TTSStaking(target).stake(1);
        else if (mode == 2) TTSStaking(target).unstake(1);
        else if (mode == 3) TTSStaking(target).claim();
        else if (mode == 4) TTSStaking(target).emergencyWithdraw();
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        require(balanceOf[msg.sender] >= amt, "insufficient");
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        _maybeReenter();
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        require(balanceOf[from] >= amt, "insufficient");
        uint256 a = allowance[from][msg.sender];
        require(a >= amt, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amt;
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        _maybeReenter();
        return true;
    }
}
