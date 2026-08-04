// TTS settlement automation — CRE workflow SKELETON (Path 1: adapter model).
//
// Logic mirrors the current Chainlink upkeep 1:1: on a cron tick, read
// Keeper3.checkUpkeep(); if upkeepNeeded, forward performUpkeep(performData) to Keeper3
// THROUGH the Chainlink AutomationReceiver (which the DON-signed report targets).
//
// This is the autonomous artifact. It cannot be registered/run without the owner's CRE
// account + CRE CLI (see outputs/cre_migration_plan.md, "Steps — YOURS"). Treat the CRE
// SDK calls below as the shape to fill in against the installed `@chainlinklabs/cre-sdk`
// version — names may differ slightly; the control flow is what matters.

// ── Config (verified on-chain 2026-08-04) ────────────────────────────────────
export const CONFIG = {
  chain: 'base-mainnet',                                   // 8453
  keeper3: '0x363ce4960e3b459f5892587a37ae1ff2ed04442c',   // target
  // performUpkeep(bytes) selector — the ONLY call the receiver authorizes (setCallAllowed)
  performUpkeepSelector: '0x4585e33b',
  checkUpkeepSelector:   '0x6e04ff0d',                     // checkUpkeep(bytes)
  automationReceiver:    '0xTODO_AFTER_DEPLOY',            // Chainlink AutomationReceiver.sol
  // cron: check every 10 min (matches the current worker cadence; the DST-safe round
  // schedule is enforced inside Keeper3.checkUpkeep, so we just poll).
  cron: '*/10 * * * *',
}

// checkUpkeep(bytes) -> (bool upkeepNeeded, bytes performData)
const CHECK_ABI = [{
  type: 'function', name: 'checkUpkeep', stateMutability: 'view',
  inputs: [{ type: 'bytes' }], outputs: [{ type: 'bool' }, { type: 'bytes' }],
}] as const

/**
 * CRE entrypoint. Pseudo-SDK — align with the installed cre-sdk:
 *   cron trigger  → runtime handler
 *   evm.read()    → static call checkUpkeep
 *   evm.write()   → send performUpkeep through the receiver (DON-signed)
 */
export async function onCron(runtime: any) {
  const evm = runtime.evm(CONFIG.chain)
  // 1) read checkUpkeep (view)
  const [upkeepNeeded, performData] = await evm.read({
    to: CONFIG.keeper3, abi: CHECK_ABI, functionName: 'checkUpkeep', args: ['0x'],
  })
  if (!upkeepNeeded) { runtime.log('no upkeep needed'); return }

  // 2) forward performUpkeep(performData) via the AutomationReceiver. The DON signs a
  //    report; the receiver verifies workflow identity (setExpectedWorkflowId/Author/Name)
  //    and that the (target, selector) is allow-listed (setCallAllowed) before calling
  //    Keeper3.performUpkeep(performData). Keeper3.s_forwarder MUST be the receiver.
  await evm.write({
    to: CONFIG.automationReceiver,
    // receiver.forward(target, callData) — exact name per AutomationReceiver.sol template
    abi: [{ type: 'function', name: 'forward', stateMutability: 'nonpayable',
            inputs: [{ type: 'address' }, { type: 'bytes' }], outputs: [] }] as const,
    functionName: 'forward',
    args: [CONFIG.keeper3, CONFIG.performUpkeepSelector + performData.slice(2)],
  })
  runtime.log('forwarded performUpkeep to Keeper3 via receiver')
}

// Registration (CRE CLI, owner's account):
//   cre workflow deploy outputs/cre/workflow.ts --chain base-mainnet
//   → note workflow id/name/author; set them on the deployed AutomationReceiver.
