// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/TTSStaking.sol";
import "../src/RescueUUPS.sol";

// PHASE 2a — deploy only (no funds, no wiring). admin+manager = Bank (operator),
// UPGRADER = a 2-day TimelockController with the Gnosis Safe as proposer/executor.
contract DeployMainnet is Script {
    address constant TTS  = 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9;
    address constant BANK = 0xB1E991bF617459B58964eEf7756B350e675C53b5;
    address constant SAFE = 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86;
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address[] memory role = new address[](1); role[0] = SAFE;
        TimelockController timelock = new TimelockController(2 days, role, role, address(0));
        TTSStaking impl = new TTSStaking();
        bytes memory init = abi.encodeWithSelector(
            TTSStaking.initialize.selector, TTS, BANK, BANK, address(timelock)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        RescueUUPS rescue = new RescueUUPS();
        vm.stopBroadcast();
        console2.log("Timelock    ", address(timelock));
        console2.log("StakingImpl ", address(impl));
        console2.log("StakingProxy", address(proxy));
        console2.log("RescueUUPS  ", address(rescue));
    }
}
