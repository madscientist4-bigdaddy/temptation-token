// Shared wallet/transaction error classification.
// Distinguishes a user-initiated rejection (MetaMask "reject", code 4001) from a
// genuine failure, so a cancel shows a neutral message instead of a scary error.

export function isUserRejection(e) {
  if (!e) return false
  // EIP-1193 user-rejected code is 4001; viem nests it under cause/info too.
  const codes = [e.code, e?.cause?.code, e?.info?.error?.code, e?.error?.code]
  if (codes.some(c => c === 4001)) return true
  const msg = (e.shortMessage || e.message || e?.cause?.shortMessage || e?.cause?.message || '').toLowerCase()
  return /user rejected|user denied|rejected the request|request rejected|denied transaction|user cancel/.test(msg)
}

// Returns { cancelled, message } for display.
// - cancelled: true  → neutral "Transaction cancelled"
// - cancelled: false → `${prefix}: <reason>`
export function describeTxError(e, prefix = 'Transaction failed') {
  if (isUserRejection(e)) return { cancelled: true, message: 'Transaction cancelled' }
  const raw = e?.shortMessage || e?.message || 'Unknown error'
  return { cancelled: false, message: `${prefix}: ${String(raw).slice(0, 60)}` }
}
