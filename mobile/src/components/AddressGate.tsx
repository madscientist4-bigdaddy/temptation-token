// The identity gate for the API-backed screens.
//
// In a dev build the address arrives from the connected wallet and this never renders.
// In Expo Go there is no connector, so the user types the address they play with. That
// is deliberately framed as "which wallet are you?", not as a login — it grants nothing.
// Every endpoint it unlocks is public or server-scoped to that same wallet, and no
// transaction can be signed without the dev build regardless of what is typed here.
import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Card, Field, Label, Btn, Note } from './Form'
import { useWallet } from '../lib/wallet'
import { isAddress } from '../lib/chain'
import { WALLET_ENABLED } from '../config/features'
import { colors, sans } from '../theme'

export function AddressGate({ purpose, onConnect }: { purpose: string; onConnect?: () => void }) {
  const { setAddress } = useWallet()
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const save = () => {
    const a = draft.trim()
    if (!isAddress(a)) { setErr('That is not a valid 0x… wallet address (42 characters).'); return }
    setErr(null)
    setAddress(a)
  }

  return (
    <Card>
      <Label>Your wallet</Label>
      <Note tone="gold">{purpose}</Note>
      {WALLET_ENABLED ? (
        <>
          <Note>Connect your wallet to continue. Nothing is signed until you approve it.</Note>
          <Btn onPress={() => onConnect?.()}>Connect wallet</Btn>
        </>
      ) : (
        <>
          <Field
            value={draft}
            onChangeText={(t) => { setDraft(t); setErr(null) }}
            placeholder="0x…"
            error={err}
            autoCapitalize="none"
          />
          <Btn onPress={save} style={{ marginTop: 10 }}>Use this address</Btn>
          <Text style={st.fine}>
            Public information only — an address authorises nothing on its own. Signing a
            transaction needs the full app build, so nothing here can move your $TTS.
          </Text>
        </>
      )}
    </Card>
  )
}

/** Compact "signed in as 0x1234…abcd" strip with a change affordance. */
export function AddressChip() {
  const { address, setAddress } = useWallet()
  if (!address) return null
  return (
    <View style={st.chip}>
      <Text style={st.chipTxt}>{address.slice(0, 6)}…{address.slice(-4)}</Text>
      <Text style={st.chipBtn} onPress={() => setAddress(null)}>change</Text>
    </View>
  )
}

const st = StyleSheet.create({
  fine: { fontFamily: sans, fontSize: 10.5, lineHeight: 16, color: colors.muted, marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
    backgroundColor: colors.surface2, borderRadius: 8, borderWidth: 1, borderColor: colors.border2,
  },
  chipTxt: { fontFamily: sans, fontSize: 12, color: colors.goldLight, fontWeight: '700' },
  chipBtn: { fontFamily: sans, fontSize: 11, color: colors.muted, textDecorationLine: 'underline', paddingVertical: 6, paddingHorizontal: 4 },
})
