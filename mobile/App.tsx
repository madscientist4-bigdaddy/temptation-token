// Temptation Token — mobile app shell. Recreates the web game's look: a sticky wallet
// bar (brand + balance + Connect), the green audit trust banner, a horizontal nav, and
// the Play / Leaderboard screens. Runs in Expo Go TODAY (browse profiles, live round
// countdown, leaderboard, profile detail, live community stats). Wallet connect + on-
// chain voting are stubbed here and light up only in an EAS dev build via WALLET_ENABLED
// (see src/config/features.ts, src/wallet/loader.ts, eas.json).
import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StatusBar, StyleSheet, Linking, ScrollView,
  useWindowDimensions,
} from 'react-native'
// NOT react-native's SafeAreaView: that one is iOS-only and a no-op on Android, so the
// wallet bar rendered UNDERNEATH the Android status bar and the CONNECT button was not
// tappable at all — verified on an emulator, where taps on it did nothing while taps on
// the tab strip worked. This version applies real insets on both platforms. (RN's own
// SafeAreaView is also deprecated and warns at runtime.)
import { SafeAreaView } from 'react-native-safe-area-context'
import { PlayScreen } from './src/screens/PlayScreen'
import { LeaderboardScreen } from './src/screens/LeaderboardScreen'
import { SubmitScreen } from './src/screens/SubmitScreen'
import { StakingScreen } from './src/screens/StakingScreen'
import { ReferralScreen } from './src/screens/ReferralScreen'
import { WalletSheet } from './src/components/WalletSheet'
import { WalletProvider, useWallet } from './src/lib/wallet'
import { WalletStack } from './src/wallet/appkit'
import { readTtsBalance, formatTTS, compactTTS } from './src/lib/chain'
import { GetTtsSheet } from './src/components/GetTtsSheet'
import { TopUpProvider } from './src/lib/topup'
import { colors, serif, sans, MAX_WIDTH } from './src/theme'

type TabKey = 'play' | 'leaderboard' | 'submit' | 'stake' | 'refer'
const TABS: { k: TabKey; l: string }[] = [
  { k: 'play', l: 'Play' },
  { k: 'leaderboard', l: 'Leaderboard' },
  { k: 'submit', l: 'Submit' },
  { k: 'stake', l: 'Stake' },
  { k: 'refer', l: 'Refer' },
]

// WalletProvider has to sit above everything that reads the address, so App is a thin
// wrapper around the real shell.
export default function App() {
  // WalletStack must be OUTERMOST: WalletProvider reads the connected account through a
  // wagmi hook, which needs WagmiProvider above it. In a wallet-less build the metro
  // resolver swaps in a pass-through stub, so this nesting costs nothing there.
  return (
    <WalletStack>
      <WalletProvider>
        <TopUpProvider>
          <Shell />
        </TopUpProvider>
      </WalletProvider>
    </WalletStack>
  )
}

function Shell() {
  const [tab, setTab] = useState<TabKey>('play')
  const [walletOpen, setWalletOpen] = useState(false)
  const { address } = useWallet()
  const [balance, setBalance] = useState<bigint | null>(null)
  const { width } = useWindowDimensions()

  // At 6.1" (390pt) the five tabs overflowed and REFER rendered as "RE". The strip did
  // scroll, but nothing said so, so the tab looked broken rather than off-screen. Shrink
  // the type and padding on narrow screens so all five fit; the ScrollView stays as a
  // backstop for anything narrower still.
  const tight = width < 420
  const navItemStyle = tight ? { paddingHorizontal: 8, paddingVertical: 13 } : null
  const navTxtStyle = tight ? { fontSize: 10, letterSpacing: 0.5 } : null

  // The wallet bar shows a real balance as soon as an address is known — this is a plain
  // eth_call, so it works with no wallet SDK involved.
  useEffect(() => {
    let live = true
    if (!address) { setBalance(null); return }
    // Only overwrite on a SUCCESSFUL read. readTtsBalance resolves null when the public
    // RPC rate-limits or times out, and writing that through blanked a known-good balance
    // to "—" on every tab switch.
    readTtsBalance(address).then((b) => { if (live && b != null) setBalance(b) }).catch(() => {})
    return () => { live = false }
  }, [address, tab])

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.void} />

      {/* Wallet bar */}
      <View style={st.wbar}>
        <View style={st.wbarInner}>
          <View style={st.brandWrap}>
            <Text style={st.brandMark}>TT</Text>
            <Text style={st.brandName}>Temptation Token</Text>
          </View>
          <View style={st.bal}>
            <Text style={st.balLabel}>Balance</Text>
            {/* Compact above a million: a founder-sized 10,000,000,000 rendered full-width
                squeezed the brand lockup down to a clipped sliver of the "TT" mark. */}
            <Text style={st.balAmt} numberOfLines={1}>
              {balance != null
                ? (balance >= 1_000_000n * 10n ** 18n ? compactTTS(balance) : formatTTS(balance, 0))
                : '—'}
              <Text style={st.balUnit}> $TTS</Text>
            </Text>
          </View>
          <Pressable style={st.connect} onPress={() => setWalletOpen(true)}>
            <Text style={st.connectTxt}>{address ? `${address.slice(0, 5)}…${address.slice(-3)}` : 'Connect'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Audit / trust banner (mirrors web) */}
      <Pressable
        style={st.trust}
        onPress={() => Linking.openURL('https://app.solidproof.io/projects/temptation-token')}
      >
        <Text style={st.trustTxt}>✓ Audited by SolidProof · Zero critical findings · View Report →</Text>
      </Pressable>

      {/* Nav */}
      <View style={st.nav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.navInner}>
          {TABS.map((t) => (
            <Pressable
              key={t.k}
              style={[st.navItem, navItemStyle, tab === t.k && st.navItemActive]}
              onPress={() => setTab(t.k)}
            >
              <Text style={[st.navTxt, navTxtStyle, tab === t.k && st.navTxtActive]} numberOfLines={1}>
                {t.l}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Screens */}
      <View style={st.main}>
        {tab === 'play' && <PlayScreen onConnect={() => setWalletOpen(true)} />}
        {tab === 'leaderboard' && <LeaderboardScreen />}
        {tab === 'submit' && <SubmitScreen onConnect={() => setWalletOpen(true)} />}
        {tab === 'stake' && <StakingScreen onConnect={() => setWalletOpen(true)} />}
        {tab === 'refer' && <ReferralScreen onConnect={() => setWalletOpen(true)} />}
      </View>

      <WalletSheet visible={walletOpen} onClose={() => setWalletOpen(false)} />
      {/* Owned at the shell, like the web app's lifted Get-$TTS modal: running dry happens
          on Play (mid-vote), Submit (entry fee) and Stake, so one instance serves all
          three and every screen can raise it through useTopUp(). */}
      <GetTtsSheet onConnect={() => setWalletOpen(true)} />
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  wbar: {
    backgroundColor: colors.deep, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  wbarInner: {
    maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  brandMark: {
    fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: colors.gold,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  brandName: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, color: colors.text, flexShrink: 1 },
  bal: { alignItems: 'center' },
  balLabel: { fontFamily: sans, fontSize: 10, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  balAmt: { fontFamily: sans, fontSize: 20, fontWeight: '800', color: colors.goldLight, lineHeight: 24 },
  balUnit: { fontSize: 11, color: colors.goldDim, fontWeight: '700' },
  connect: {
    backgroundColor: colors.crimsonGlow, borderWidth: 1, borderColor: colors.crimsonGlow,
    borderRadius: 5, paddingHorizontal: 16, paddingVertical: 12,
  },
  connectTxt: { color: colors.text, fontFamily: sans, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  trust: {
    backgroundColor: 'rgba(46,204,113,0.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(46,204,113,0.15)',
    paddingVertical: 6, paddingHorizontal: 16,
  },
  trustTxt: { color: colors.green, fontSize: 10.5, textAlign: 'center', letterSpacing: 0.6, fontWeight: '600', fontFamily: sans },
  nav: { backgroundColor: colors.deep, borderBottomWidth: 1, borderBottomColor: colors.border },
  navInner: { maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 6 },
  navItem: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navItemActive: { borderBottomColor: colors.gold },
  navTxt: { fontFamily: sans, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', color: 'rgba(240,232,216,0.75)' },
  navTxtActive: { color: colors.gold },
  main: { flex: 1, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },
})
