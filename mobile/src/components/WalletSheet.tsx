// On-brand "connect wallet" sheet. In Expo Go (WALLET_ENABLED=false) wallet actions are
// stubbed: instead of WalletConnect we explain that on-chain voting needs the full build
// and offer to open the web app. In a dev build (WALLET_ENABLED=true) the same sheet is
// where the real Reown AppKit connect flow is wired in (loadWallet()).
import React from 'react'
import { Modal, View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { colors, serif, sans } from '../theme'
import { WALLET_ENABLED, FULL_APP_URL } from '../config/features'

export function WalletSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.handle} />
          <Text style={st.title}>Connect Wallet</Text>
          <Text style={st.body}>
            {WALLET_ENABLED
              ? 'Choose a wallet to connect on Base and vote with $TTS.'
              : 'On-chain voting connects your wallet on Base. In this preview, casting votes and buying $TTS happen in the full app — open it below to connect and play.'}
          </Text>

          <Pressable style={st.primary} onPress={() => Linking.openURL(FULL_APP_URL)}>
            <Text style={st.primaryTxt}>{WALLET_ENABLED ? 'Choose Wallet' : 'Open the full app to vote →'}</Text>
          </Pressable>

          <View style={st.note}>
            <Text style={st.noteTxt}>
              {WALLET_ENABLED
                ? 'MetaMask · Rainbow · Coinbase · Trust · or a passkey Smart Wallet.'
                : 'In-app WalletConnect ships in the TestFlight / dev build. This preview is browse + live standings only.'}
            </Text>
          </View>

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
  cancel: { marginTop: 18 },
  cancelTxt: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', fontFamily: sans },
})
