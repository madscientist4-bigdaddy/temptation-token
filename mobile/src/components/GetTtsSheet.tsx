// "Get $TTS" — the mobile counterpart of the web app's GetTtsModal, raised by any screen
// that hits a dry balance (vote, 5 $TTS entry fee, staking) through useTopUp().
//
// Two deliberate constraints carried over from web:
//
//  1. GUARDED SWAP ONLY. The TTS/WETH pool is thin (~0.53 WETH live), so any purchase
//     over 5% price impact is REFUSED rather than merely warned about — the quote is
//     recomputed from live reserves and the button disables itself. Verified against
//     mainnet: the ceiling binds at ~0.026 ETH today.
//  2. NO CARD PATH. Transak cannot deliver $TTS (unlisted), so the card leg would sell
//     the user ETH/USDC they then have to swap — and with no PRODUCTION Transak key
//     configured for mobile it stays hidden entirely. A half-configured on-ramp moves
//     real money from a stranger's card; it does not get to render "nearly".
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, Linking, ActivityIndicator, ScrollView } from 'react-native'
import { colors, serif, sans } from '../theme'
import { useTopUp } from '../lib/topup'
import { useWallet } from '../lib/wallet'
import { FULL_APP_URL } from '../config/features'
import { readReserves, quoteEthForTts, maxSpendUnderCeiling, MAX_IMPACT_BPS, type Reserves } from '../lib/swap'
import { formatTTS } from '../lib/chain'

const UNISWAP_URL =
  'https://app.uniswap.org/swap?chain=base&outputCurrency=0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'

/** Card leg stays dark until a PRODUCTION key exists. Mobile has none, by design. */
const TRANSAK_KEY = process.env.EXPO_PUBLIC_TRANSAK_API_KEY || ''
const TRANSAK_ENV = (process.env.EXPO_PUBLIC_TRANSAK_ENV || 'STAGING').toUpperCase()
export const CARD_ENABLED = TRANSAK_ENV === 'PRODUCTION' && !!TRANSAK_KEY

const fmtEth = (wei: bigint, dp = 4) => {
  const s = (Number(wei) / 1e18).toFixed(dp)
  return s.replace(/\.?0+$/, '') || '0'
}

export function GetTtsSheet({ onConnect }: { onConnect: () => void }) {
  const { current, close } = useTopUp()
  const { address, canTransact } = useWallet()
  const open = !!current

  const [amount, setAmount] = useState('0.01')
  const [res, setRes] = useState<Reserves | null>(null)
  const [loading, setLoading] = useState(false)
  const [poolErr, setPoolErr] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true)
    setPoolErr(false)
    readReserves()
      .then((r) => {
        if (!live) return
        setRes(r)
        setPoolErr(r == null)
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open])

  const ethIn = useMemo(() => {
    const n = Number(amount)
    if (!isFinite(n) || n <= 0) return 0n
    // Via string to avoid float drift on the way into wei.
    return BigInt(Math.round(n * 1e9)) * 10n ** 9n
  }, [amount])

  const q = useMemo(() => (res ? quoteEthForTts(ethIn, res) : null), [ethIn, res])
  const cap = useMemo(() => (res ? maxSpendUnderCeiling(res) : 0n), [res])

  const openUniswap = useCallback(() => { Linking.openURL(UNISWAP_URL) }, [])

  if (!open) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={st.backdrop} onPress={close}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={st.handle} />
            <Text style={st.title}>Get $TTS</Text>

            {/* The shortfall, stated in full. This is the whole point of the sheet. */}
            {current?.reason ? (
              <View style={st.reason}>
                <Text style={st.reasonTxt}>{current.reason}</Text>
              </View>
            ) : null}

            {!address ? (
              <>
                <Text style={st.body}>Set your wallet first so we can price a swap into it.</Text>
                <Pressable style={st.primary} onPress={() => { close(); onConnect() }}>
                  <Text style={st.primaryTxt}>Connect wallet</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={st.label}>Spend (ETH on Base)</Text>
                <TextInput
                  style={st.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.01"
                  placeholderTextColor="rgba(240,232,216,0.3)"
                />

                {loading ? (
                  <ActivityIndicator color={colors.gold} style={{ marginVertical: 16 }} />
                ) : poolErr ? (
                  <Text style={st.warn}>
                    Could not read the pool just now, so we will not quote you a price. Try again in a
                    moment — this is a network problem, not a problem with your wallet.
                  </Text>
                ) : q ? (
                  <View style={st.quote}>
                    <Row k="You receive" v={`≈ ${formatTTS(q.out, 0)} $TTS`} />
                    <Row
                      k="Price impact"
                      v={`${(q.impactBps / 100).toFixed(2)}%`}
                      tone={q.allowed ? 'ok' : 'bad'}
                    />
                    <Row k="Most we will sell" v={`${fmtEth(cap)} ETH`} />
                  </View>
                ) : null}

                {q && !q.allowed ? (
                  <View style={st.refuse}>
                    <Text style={st.refuseTxt}>
                      Refused — this trade would move the $TTS price by more than{' '}
                      {(MAX_IMPACT_BPS / 100).toFixed(0)}%. The pool is thin, so a purchase this size
                      costs you far more than it should. Try {fmtEth(cap)} ETH or less.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={[st.primary, (!q || !q.allowed) && st.primaryOff]}
                  disabled={!q || !q.allowed}
                  onPress={openUniswap}
                >
                  <Text style={st.primaryTxt}>
                    {canTransact ? 'Swap on Uniswap' : 'Open Uniswap to swap'}
                  </Text>
                </Pressable>

                <Text style={st.note}>
                  {canTransact
                    ? 'The swap is signed in your wallet. We never take custody of your funds.'
                    : 'This build cannot sign transactions, so the swap opens in Uniswap with $TTS preselected. The quote and the 5% limit above are live either way.'}
                </Text>

                {/* Card leg: hidden, and said out loud rather than left as a mystery gap. */}
                {CARD_ENABLED ? null : (
                  <Text style={st.cardNote}>
                    Card purchases are not available in the app. No service sells $TTS directly — a
                    card would only buy you ETH to swap — and we will not run that flow without a
                    production payment key. Anyone telling you otherwise is not selling you $TTS.
                  </Text>
                )}
              </>
            )}

            <Pressable style={st.cancel} onPress={close}>
              <Text style={st.cancelTxt}>Not now</Text>
            </Pressable>
            <Pressable style={st.cancel} onPress={() => Linking.openURL(FULL_APP_URL)}>
              <Text style={st.cancelTxt}>Open the full app →</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'ok' | 'bad' }) {
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={[st.rowV, tone === 'bad' && { color: colors.rose }, tone === 'ok' && { color: colors.green }]}>
        {v}
      </Text>
    </View>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.deep, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 34, maxHeight: '88%',
  },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16, alignSelf: 'center' },
  title: { fontFamily: serif, fontStyle: 'italic', fontSize: 26, color: colors.text, marginBottom: 12, textAlign: 'center' },
  reason: {
    backgroundColor: 'rgba(212,175,55,0.08)', borderLeftWidth: 3, borderLeftColor: colors.gold,
    borderRadius: 6, padding: 12, marginBottom: 16,
  },
  reasonTxt: { fontFamily: sans, fontSize: 13.5, color: colors.text, lineHeight: 20 },
  body: { fontFamily: sans, fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 18, textAlign: 'center' },
  label: { fontFamily: sans, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: colors.void, borderWidth: 1, borderColor: colors.border2, borderRadius: 6,
    paddingHorizontal: 13, paddingVertical: 13, minHeight: 48, color: colors.text, fontFamily: sans, fontSize: 16,
  },
  quote: { marginTop: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowK: { fontFamily: sans, fontSize: 12.5, color: colors.muted },
  rowV: { fontFamily: sans, fontSize: 13.5, color: colors.goldLight, fontWeight: '700' },
  refuse: {
    marginTop: 12, backgroundColor: 'rgba(232,64,90,0.08)', borderLeftWidth: 3, borderLeftColor: colors.rose,
    borderRadius: 6, padding: 12,
  },
  refuseTxt: { fontFamily: sans, fontSize: 12.5, color: colors.text, lineHeight: 19 },
  warn: { fontFamily: sans, fontSize: 12.5, color: colors.muted, lineHeight: 19, marginVertical: 14 },
  primary: {
    backgroundColor: colors.crimsonGlow, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.rose, marginTop: 16,
  },
  primaryOff: { opacity: 0.4 },
  primaryTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  note: { fontFamily: sans, fontSize: 11.5, color: colors.goldDim, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  cardNote: { fontFamily: sans, fontSize: 11.5, color: colors.muted, lineHeight: 18, marginTop: 14 },
  cancel: { marginTop: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', fontFamily: sans },
})
