// Running-out-of-$TTS is a cross-screen event, so the request for a top-up is lifted to
// a context exactly as the web app lifts its Get-$TTS modal to the parent. Play (mid-
// vote), Submit (the 5 $TTS entry fee) and Stake all hit the same wall, and each used to
// have no answer at all on mobile — the button simply did nothing.
//
// The important part is `requireBalance`: it does not just say "you need more", it says
// how much more. A shortfall the user has to compute themselves is the moment they quit.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { formatTTS } from './chain'

export type TopUpRequest = {
  /** Sentence explaining why the top-up is being asked for. */
  reason: string
  /** Exact shortfall in wei, when the caller knew both sides of the sum. */
  short?: bigint
  /** What the action needed, in wei. */
  need?: bigint
  /** What the wallet holds, in wei. */
  have?: bigint
}

type Ctx = {
  request: (reason: string) => void
  /**
   * Open the sheet ONLY if `have` cannot cover `need`, naming the exact shortfall.
   * Returns true when the balance is sufficient and the caller may proceed.
   */
  requireBalance: (args: { need: bigint; have: bigint | null; action: string }) => boolean
  current: TopUpRequest | null
  close: () => void
}

const TopUpCtx = createContext<Ctx>({
  request: () => {},
  requireBalance: () => true,
  current: null,
  close: () => {},
})

export function TopUpProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<TopUpRequest | null>(null)

  const request = useCallback((reason: string) => setCurrent({ reason }), [])

  const requireBalance = useCallback(
    ({ need, have, action }: { need: bigint; have: bigint | null; action: string }) => {
      // An unknown balance is not a proven shortfall — let the caller proceed and let the
      // chain reject it, rather than accusing someone of being broke because the RPC was
      // slow. (readTtsBalance resolves null on transport failure.)
      if (have == null) return true
      if (have >= need) return true
      const short = need - have
      setCurrent({
        reason:
          `${action} needs ${formatTTS(need, 0)} $TTS and you have ${formatTTS(have, 0)}. ` +
          `You are ${formatTTS(short, 0)} $TTS short.`,
        short,
        need,
        have,
      })
      return false
    },
    []
  )

  const close = useCallback(() => setCurrent(null), [])

  const value = useMemo<Ctx>(() => ({ request, requireBalance, current, close }), [request, requireBalance, current, close])
  return <TopUpCtx.Provider value={value}>{children}</TopUpCtx.Provider>
}

export const useTopUp = () => useContext(TopUpCtx)
