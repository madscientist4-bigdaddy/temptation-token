// ── Sponsored transaction helper ──────────────────────────────────────────────
//
// One entry point, `useSendMaybeSponsored`, that sends a batch of calls gaslessly when
// everything lines up and otherwise falls back to the ordinary user-paid path. Callers
// do not branch — they just send calls and await a receipt.
//
// It goes sponsored only when ALL of these hold:
//   1. GASLESS_ENABLED is on,
//   2. the connected wallet advertises EIP-5792 `atomic`/`paymasterService` capability
//      on Base (i.e. it is a smart account, not an EOA),
//   3. our paymaster proxy actually grants sponsorship (caps + allowlist pass).
//
// (2) and (3) are why this is written as graceful degradation rather than a hard switch:
// an EOA user, a capped-out user and a misconfigured paymaster must all still be able to
// transact normally. The only difference they should notice is who paid the gas.

import { useCallback } from 'react'
import { useAccount, useCapabilities, useSendCalls, useWaitForCallsStatus } from 'wagmi'
import { useWriteContract, usePublicClient } from 'wagmi'
import { base } from 'wagmi/chains'
import { GASLESS_ENABLED, paymasterUrl } from '../config/gasless.js'

/**
 * True when the connected wallet can accept a paymaster on Base.
 * Wallet capability shape (EIP-5792): { [chainIdHex]: { paymasterService: { supported } } }
 */
export function useSponsorshipAvailable() {
  const { address, isConnected } = useAccount()
  const { data: caps } = useCapabilities({
    account: address,
    query: { enabled: Boolean(GASLESS_ENABLED && isConnected && address) },
  })
  if (!GASLESS_ENABLED || !caps) return false
  // Capability keys may be decimal or hex depending on wallet build — check both.
  const entry = caps[base.id] || caps[`0x${base.id.toString(16)}`]
  return Boolean(entry?.paymasterService?.supported)
}

/**
 * Returns send(calls) -> { hash, sponsored }.
 * `calls` is [{ to, abi, functionName, args }] or [{ to, data, value }].
 */
export function useSendMaybeSponsored() {
  const sponsorable = useSponsorshipAvailable()
  const { sendCallsAsync } = useSendCalls()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  return useCallback(async (calls) => {
    if (sponsorable) {
      try {
        const result = await sendCallsAsync({
          calls,
          capabilities: { paymasterService: { url: paymasterUrl() } },
        })
        return { id: result?.id ?? result, sponsored: true }
      } catch (e) {
        // Paymaster declined (cap hit, contract not allowlisted, upstream down) or the
        // wallet rejected the batch. A user rejection must NOT silently re-prompt as an
        // unsponsored tx — that would charge someone who explicitly cancelled.
        if (isUserRejection(e)) throw e
        // otherwise fall through to the normal path
      }
    }

    // Fallback: sequential ordinary transactions, user pays gas.
    let last
    for (const c of calls) {
      if (c.abi) {
        last = await writeContractAsync({
          address: c.to, abi: c.abi, functionName: c.functionName, args: c.args, value: c.value,
        })
      } else {
        throw new Error('raw-data calls require a sponsored batch or an explicit writeContract')
      }
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: last })
    }
    return { hash: last, sponsored: false }
  }, [sponsorable, sendCallsAsync, writeContractAsync, publicClient])
}

/** Await a sponsored batch and surface the resulting tx hash. */
export function useSponsoredReceipt(id) {
  return useWaitForCallsStatus({ id, query: { enabled: Boolean(id) } })
}

// Shared with src/lib/txError.js semantics — user rejections are not failures to retry.
export function isUserRejection(e) {
  const m = `${e?.shortMessage || e?.message || e || ''}`.toLowerCase()
  return e?.code === 4001 || m.includes('user rejected') || m.includes('user denied') ||
         m.includes('rejected the request') || m.includes('cancelled') || m.includes('canceled')
}

/**
 * Resolve an EIP-5792 batch id to the on-chain tx hash.
 *
 * Needed because the rest of the app keys off a tx hash — the receipt wait, the
 * /api/profiles?action=vote record and the vote-match bonus all take one. A sponsored
 * batch returns a batch id instead, so we wait for it to be confirmed and pull the hash
 * of the resulting transaction (a batch settles as a single tx for a smart account).
 */
export async function waitForCallsTxHash(id, { timeout = 120_000 } = {}) {
  const { waitForCallsStatus } = await import('@wagmi/core')
  const { wagmiConfig } = await import('../config/wallet.js')
  const res = await waitForCallsStatus(wagmiConfig, { id, timeout })
  if (res?.status && res.status !== 'success') {
    throw new Error(`sponsored batch did not succeed (status: ${res.status})`)
  }
  return res?.receipts?.[res.receipts.length - 1]?.transactionHash || null
}
