// On-brand "connect wallet" sheet.
//
// In a dev build (WALLET_ENABLED) this is where the real Reown AppKit connect flow runs.
// In Expo Go there is no connector, so it does the next most useful thing: it takes the
// address the player uses, which unlocks every read and API-backed flow in the app
// (balance, stake position, KYC, submit prep, referral link). See src/lib/wallet.tsx for
// why an address is identity and not a credential — nothing here can sign anything.
import React, { useState } from 'react'
import { Modal, View, Text, Pressable, Linking, StyleSheet, TextInput } from 'react-native'
import { colors, serif, sans } from '../theme'
import { WALLET_ENABLED, FULL_APP_URL } from '../config/features'
import { useWallet } from '../lib/wallet'
import { isAddress } from '../lib/chain'

export function WalletSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { address, setAddress } = useWallet()
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    const a = draft.trim()
    if (!isAddress(a)) { setErr('That is not a valid 0x… address (42 characters).'); return }
    setErr(null)
    await setAddress(a)
    setDraft('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.handle} />
          <Text style={st.title}>{WALLET_ENABLED ? 'Connect Wallet' : address ? 'Your Wallet' : 'Set Your Wallet'}</Text>

          {WALLET_ENABLED ? (
            <>
              <Text style={st.body}>Choose a wallet to connect on Base and vote with $TTS.</Text>
              <Pressable style={st.primary} onPress={() => Linking.openURL(FULL_APP_URL)}>
                <Text style={st.primaryTxt}>Choose Wallet</Text>
              </Pressable>
              <View style={st.note}>
                <Text style={st.noteTxt}>MetaMask · Rainbow · Coinbase · Trust · or a passkey Smart Wallet.</Text>
              </View>
            </>
          ) : address ? (
            <>
              <Text style={st.body}>
                Reading on-chain data for this wallet. Casting votes, paying the entry fee and staking
                each need a wallet signature, which happens in the full app.
              </Text>
              <Text style={st.addr} selectable>{address}</Text>
              <Pressable style={st.primary} onPress={() => Linking.openURL(FULL_APP_URL)}>
                <Text style={st.primaryTxt}>Open the full app to vote →</Text>
              </Pressable>
              <Pressable style={st.cancel} onPress={async () => { await setAddress(null); onClose() }}>
                <Text style={st.cancelTxt}>Use a different wallet</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={st.body}>
                Enter the wallet address you play with. It unlocks your balance, stake, verification
                status and referral link. It is public information and authorises nothing — signing
                still needs the full app.
              </Text>
              <TextInput
                style={[st.input, !!err && st.inputErr]}
                value={draft}
                onChangeText={(t) => { setDraft(t); setErr(null) }}
                placeholder="0x…"
                placeholderTextColor="rgba(240,232,216,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {err ? <Text style={st.err}>{err}</Text> : null}
              <Pressable style={st.primary} onPress={save}>
                <Text style={st.primaryTxt}>Use this address</Text>
              </Pressable>
              <View style={st.note}>
                <Text style={st.noteTxt}>In-app WalletConnect ships in the TestFlight / dev build.</Text>
              </View>
            </>
          )}

          <Pressable style={st.cancel} onPress={onClose}>
            <Text style={st.cancelTxt}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.deep,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 },
  title: { fontFamily: serif, fontStyle: 'italic', fontSize: 26, color: colors.text, marginBottom: 10 },
  body: { fontFamily: sans, fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center', marginBottom: 22 },
  primary: {
    backgroundColor: colors.crimsonGlow,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.rose,
  },
  primaryTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  note: { marginTop: 16, paddingHorizontal: 8 },
  noteTxt: { color: colors.goldDim, fontSize: 11.5, textAlign: 'center', lineHeight: 18, fontFamily: sans },
  cancel: { marginTop: 18, minHeight: 44, justifyContent: 'center' },
  cancelTxt: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', fontFamily: sans },
  input: {
    width: '100%', backgroundColor: colors.void, borderWidth: 1, borderColor: colors.border2,
    borderRadius: 6, paddingHorizontal: 13, paddingVertical: 13, minHeight: 48, marginBottom: 12,
    color: colors.text, fontFamily: sans, fontSize: 14,
  },
  inputErr: { borderColor: colors.rose },
  err: { color: colors.rose, fontFamily: sans, fontSize: 11, marginBottom: 10, alignSelf: 'flex-start' },
  addr: { fontFamily: sans, fontSize: 12.5, color: colors.goldLight, marginBottom: 20, textAlign: 'center' },
})
