// Keeper autopilot decision core — PURE, side-effect-free, testable.
//
// WHY THIS EXISTS
// Chainlink Automation registry 2.3.0 on Base (0xf4bAb6A1…) stopped performing ANY
// upkeep on 2026-08-05 — registry-wide, all ~191 upkeeps, not just ours. Our upkeep
// 113446…5208 is funded (44 LINK), unpaused, uncancelled, and checkUpkeep() returns
// true on schedule; nothing comes. Rounds 6→7 and 7→8 were both closed by hand from
// the Bank wallet ~17.7h after the calendar pin. This replaces that hand.
//
// The Bank wallet is TTSKeeper3.owner(), and manualExecute(action) is onlyOwner, so
// the Bank can do exactly what the Chainlink forwarder would have done — and nothing
// else. The action is read straight from Keeper3.checkUpkeep(), so this mirrors the
// keeper 1:1 rather than reimplementing the schedule.
//
// DISARMED BY DEFAULT. Requires admin_config.keeper_autopilot_enabled = true. A Bank
// wallet transaction needs Jim's explicit go-ahead (CLAUDE.md), and arming this is
// that go-ahead — expressed once, as a config flag, instead of weekly at midnight.

export const KEEPER_AUTOPILOT = {
  // Chainlink gets first refusal. If the DON ever recovers we must not race it: a
  // double settleRound() is caught by the keeper's try/catch, but a double
  // startRound() would burn gas and muddy the audit trail.
  GRACE_SEC: 900,            // 15 min past the calendar pin before we act
  MIN_INTERVAL_SEC: 300,     // ≥5 min between our own actions (VRF needs a moment)
  MAX_ACTIONS_24H: 6,        // runaway guard. A clean rollover is 2 (settle + start),
                             // but slots are now reserved BEFORE the send, so failed
                             // attempts consume them too — a week with one retried
                             // settle legitimately reaches 3-4. 6 keeps the loop
                             // bounded without tripping on an honest retry.
}
const C = KEEPER_AUTOPILOT

export const ACTION = { 1: 'START_ROUND', 3: 'SETTLE', 4: 'ROLLOVER' }

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const no = (reason, alert = null) => ({ act: false, action: null, reason, alert })

/**
 * Decide whether to fire Keeper3.manualExecute(action). Pure: same inputs → same output.
 * Inputs:
 *   enabled          admin_config.keeper_autopilot_enabled (kill switch; default FALSE)
 *   hasBankKey       !!process.env.DEPLOYER_PRIVATE_KEY
 *   upkeepNeeded     Keeper3.checkUpkeep()[0]
 *   action           decoded from performData (1 START_ROUND | 3 SETTLE | 4 ROLLOVER)
 *   nowSec           block/wall clock, seconds
 *   endTime          current round's endTime (the calendar pin), seconds
 *   vrfPending       current round's vrfPending flag
 *   actionsLast24h   count of autopilot actions in the trailing 24h
 *   lastActionAtSec  unix seconds of our most recent action (0 if none)
 * Returns { act, action, reason, alert }.
 *   alert !== null means "tell a human", whether or not we acted.
 */
export function evaluateKeeperAutopilot(i = {}) {
  // 0. KILL SWITCH — off means completely inert, no reads acted on, no writes.
  if (!i.enabled) return no('keeper autopilot disabled')

  // 1. Bank key required — manualExecute is onlyOwner and the owner is the Bank.
  if (!i.hasBankKey) return no('DEPLOYER_PRIVATE_KEY not set — cannot send')

  // 2. Nothing to do. The overwhelmingly common case: mid-round, checkUpkeep false.
  if (!i.upkeepNeeded) return no('checkUpkeep: nothing due')

  const action = num(i.action, 0)
  if (!ACTION[action]) return no(`unknown action ${i.action}`, `Keeper returned an action this autopilot does not know: ${i.action}`)

  const now = num(i.nowSec, 0)
  const endTime = num(i.endTime, 0)

  // 3. VRF STALL is a different failure with a different runbook — never paper over
  //    it by re-calling settleRound(); the request is already in flight.
  if (action === 3 && i.vrfPending) {
    return no('settle due but VRF already pending', `Round settlement is stalled with VRF PENDING (${Math.round((now - endTime) / 3600)}h past close). Autopilot will NOT re-settle — this needs the VRF recovery runbook.`)
  }

  // 4. GRACE — give Chainlink first refusal, so a recovered DON and this autopilot
  //    can never both fire on the same tick.
  const overdue = now - endTime
  if (overdue < C.GRACE_SEC) return no(`work due but only ${Math.max(0, Math.round(overdue / 60))}min past the pin — holding ${Math.round(C.GRACE_SEC / 60)}min for Chainlink`)

  // 5. MIN INTERVAL — after a settle, VRF needs time to fulfil before a start is
  //    even possible. Don't spend gas discovering that every tick.
  const lastAt = num(i.lastActionAtSec, 0)
  if (lastAt > 0 && now - lastAt < C.MIN_INTERVAL_SEC) {
    return no(`last autopilot action ${Math.round((now - lastAt) / 60)}min ago — min interval ${Math.round(C.MIN_INTERVAL_SEC / 60)}min`)
  }

  // 6. RUNAWAY GUARD — a normal weekly rollover is exactly two actions. If we are
  //    past four in a day, something is looping; stop and shout rather than burn gas.
  const recent = num(i.actionsLast24h, 0)
  if (recent >= C.MAX_ACTIONS_24H) {
    return no(`24h action cap reached (${recent}/${C.MAX_ACTIONS_24H})`, `Keeper autopilot hit its 24h action cap (${recent}). It has stopped acting. Something is looping — check Keeper3 and V3d state by hand.`)
  }

  return { act: true, action, reason: `${ACTION[action]} due, ${Math.round(overdue / 3600)}h past the pin`, alert: null }
}
