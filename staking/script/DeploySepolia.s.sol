// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "../src/TTSStaking.sol";
import "../mocks/Mocks.sol";

/**
 * Gate C — deploy the full mock stack to Base Sepolia and wire it, mirroring the
 * mainnet role model: UPGRADER_ROLE = a TimelockController (never an EOA).
 *
 * Env:
 *   PRIVATE_KEY   deployer (funded Sepolia ETH)
 *   SAFE_STANDIN  address that plays the Gnosis Safe on testnet (proposer/executor
 *                 of the timelock, DEFAULT_ADMIN + MANAGER of staking). Defaults to
 *                 the deployer if unset.
 *
 * Run:
 *   forge script script/DeploySepolia.s.sol --rpc-url $BASE_SEPOLIA_RPC \
 *     --broadcast --verify --etherscan-api-key $BASESCAN_KEY
 *
 * After deploy, live-fire (see script/SEPOLIA_RUNBOOK.md):
 *   stake → getStakeDetails → claim → partial unstake → full unstake →
 *   emergencyWithdraw. Eligibility (7 days) is proven in Foundry; on Sepolia it is
 *   verified by getStakingTier reverting "not eligible" immediately after stake.
 */
contract DeploySepolia is Script {
    // Example thresholds (mock TTS): 50k / 100k / 250k / 1M / 5M
    uint256 constant T_BRONZE  =    50_000e18;
    uint256 constant T_SILVER  =   100_000e18;
    uint256 constant T_GOLD    =   250_000e18;
    uint256 constant T_DIAMOND = 1_000_000e18;
    uint256 constant T_VIP     = 5_000_000e18;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address safe = vm.envOr("SAFE_STANDIN", deployer);

        vm.startBroadcast(pk);

        // 1. Mock TTS with 1% tax + exemption allowlist (mirrors mainnet token).
        MockTTSTax tts = new MockTTSTax(safe); // tax treasury = safe stand-in
        tts.mint(deployer, 30_000_000_000e18); // 30B for pool + test stakes

        // 2. Timelock (Safe stand-in is proposer & executor; 1h delay for testnet).
        address[] memory props = new address[](1); props[0] = safe;
        address[] memory execs = new address[](1); execs[0] = safe;
        TimelockController timelock = new TimelockController(1 hours, props, execs, address(0));

        // 3. Staking impl + proxy. UPGRADER = timelock (NEVER an EOA).
        TTSStaking impl = new TTSStaking();
        bytes memory init = abi.encodeWithSelector(
            TTSStaking.initialize.selector, address(tts), safe, safe, address(timelock)
        );
        TestProxy proxy = new TestProxy(address(impl), init);
        TTSStaking staking = TTSStaking(address(proxy));

        // 4. Make staking tax-exempt (mainnet: Safe calls setTaxExempt on real TTS).
        tts.setTaxExempt(address(staking), true);

        // 5. Stub voting consumer (Gate D swaps in real V3d).
        StubVotingV3d voting = new StubVotingV3d(address(staking));

        // 6. Thresholds + fund the 10B mock reward pool. (In prod these are Safe txs;
        //    on testnet the deployer holds MANAGER only if safe==deployer. If a
        //    distinct SAFE_STANDIN is used, run steps 6a/6b from that account.)
        if (safe == deployer) {
            staking.setTierThresholds(T_BRONZE, T_SILVER, T_GOLD, T_DIAMOND, T_VIP);
        }
        tts.approve(address(staking), type(uint256).max);
        staking.fundRewards(10_000_000_000e18);

        vm.stopBroadcast();

        console2.log("MockTTS      ", address(tts));
        console2.log("Timelock     ", address(timelock));
        console2.log("Staking impl ", address(impl));
        console2.log("Staking proxy", address(staking));
        console2.log("StubVoting   ", address(voting));
        console2.log("Deployer     ", deployer);
        console2.log("Safe standin ", safe);
        console2.log("Reward pool  ", staking.rewardSurplus());
    }
}
