// Wallet IDENTITY, which is a different thing from wallet CAPABILITY — and keeping them
// apart is what lets most of the app work in Expo Go.
//
//   identity  = "which address is this person?"  → an address string
//   capability = "can this app sign a transaction?" → WALLET_ENABLED (dev build only)
//
// Everything server-side (KYC status, ID upload, submission quota, referral link) and
// every on-chain READ (balance, stake position, tier) needs only the identity. Only the
// four actual writes — pay the 5 TTS submission fee, vote, stake/unstake, claim — need
// the capability, and those stay behind the seam.
//
// In a dev build the address comes from the connected wallet. In Expo Go there is no
// connector, so the user can paste/type their address to unlock the read-only and
// API-backed flows. That address is NOT a credential: it is public information, it
// authorises nothing, and every endpoint it touches is either public or (for ID upload)
// server-scoped to that same wallet. It is persisted so it survives an app restart.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { WALLET_ENABLED } from '../config/features'
import { isAddress } from './chain'
import { useConnectedAddress } from '../wallet/appkit'

const STORAGE_KEY = 'tts.wallet.address'

type Ctx = {
  address: string | null
  /** true when this address came from a real connected wallet (dev build). */
  connected: boolean
  /** true when the app can actually sign — the seam. */
  canTransact: boolean
  setAddress: (a: string | null) => Promise<void>
  ready: boolean
}

const WalletCtx = createContext<Ctx>({
  address: null,
  connected: false,
  canTransact: false,
  setAddress: async () => {},
  ready: false,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v && isAddress(v)) setAddr(v) })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const setAddress = useCallback(async (a: string | null) => {
    const next = a && isAddress(a) ? a.trim() : null
    setAddr(next)
    try {
      if (next) await AsyncStorage.setItem(STORAGE_KEY, next)
      else await AsyncStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage failure is survivable — the address just won't persist across restarts.
    }
  }, [])

  // A REAL connected wallet outranks a typed address. Typing is the fallback for builds
  // with no connector; once a wallet is actually connected it is the only address that can
  // sign, so letting a stale typed value win would send a vote from the wrong account.
  const { address: connectedAddress, isConnected } = useConnectedAddress()
  const effective = connectedAddress ?? address

  const value = useMemo<Ctx>(
    () => ({
      address: effective,
      connected: isConnected,
      // Only a genuinely connected wallet can sign. A typed address is identity, never
      // capability — see the header of this file.
      canTransact: WALLET_ENABLED && isConnected && !!connectedAddress,
      setAddress,
      ready,
    }),
    [effective, isConnected, connectedAddress, setAddress, ready]
  )
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export const useWallet = () => useContext(WalletCtx)
