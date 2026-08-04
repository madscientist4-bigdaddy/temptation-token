// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/**
 * RescueUUPS — one-purpose implementation used to extract the 10B TTS stranded in the
 * OLD broken staking UUPS proxy (0xaA12B889…). That proxy has no withdraw function, but
 * it IS a UUPS proxy and the Bank wallet holds its UPGRADER + DEFAULT_ADMIN roles, so:
 *
 *   1. Bank calls oldProxy.upgradeTo(RescueUUPS)   (authorized by the current UUPS impl)
 *   2. Bank calls oldProxy.rescue(TTS, newStaking, amount)  (staged: 1,000 then remainder)
 *
 * SAFETY:
 * - The rescue/upgrade gate is a HARD-CODED Bank address — no dependency on the old
 *   proxy's storage layout, so it cannot be mis-gated by a storage collision.
 * - proxiableUUID() returns the EIP-1967 impl slot so the UUPS upgrade validation passes.
 * - It stays upgradeable by Bank (upgradeTo/upgradeToAndCall) so the proxy can never brick.
 * - It only moves ERC-20 balances OUT via transfer; it holds/needs no other state.
 */
contract RescueUUPS {
    // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
    bytes32 private constant _IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    address public constant BANK = 0xB1E991bF617459B58964eEf7756B350e675C53b5;

    event Rescued(address indexed token, address indexed to, uint256 amount);
    event Upgraded(address indexed implementation);

    modifier onlyBank() { require(msg.sender == BANK, "RescueUUPS: not bank"); _; }

    /// ERC-1822: must equal the EIP-1967 impl slot for UUPS upgrade validation to pass.
    function proxiableUUID() external pure returns (bytes32) { return _IMPL_SLOT; }

    /// Move an ERC-20 balance out of the proxy. Staged migration = call twice.
    function rescue(address token, address to, uint256 amount) external onlyBank {
        require(to != address(0), "RescueUUPS: zero to");
        require(IERC20Min(token).transfer(to, amount), "RescueUUPS: transfer failed");
        emit Rescued(token, to, amount);
    }

    function tokenBalance(address token) external view returns (uint256) {
        return IERC20Min(token).balanceOf(address(this));
    }

    // Keep the proxy upgradeable by Bank so it can never be left bricked.
    function upgradeTo(address newImpl) external onlyBank { _setImpl(newImpl); }
    function upgradeToAndCall(address newImpl, bytes calldata data) external onlyBank {
        _setImpl(newImpl);
        if (data.length > 0) { (bool ok, ) = newImpl.delegatecall(data); require(ok, "RescueUUPS: call failed"); }
    }
    function _setImpl(address newImpl) private {
        require(newImpl.code.length > 0, "RescueUUPS: not a contract");
        assembly { sstore(_IMPL_SLOT, newImpl) }
        emit Upgraded(newImpl);
    }
}
