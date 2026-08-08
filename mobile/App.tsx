// Temptation Token — mobile app shell. Recreates the web game's look: a sticky wallet
// bar (brand + balance + Connect), the green audit trust banner, a horizontal nav, and
// the Play / Leaderboard screens. Runs in Expo Go TODAY (browse profiles, live round
// countdown, leaderboard, profile detail, live community stats). Wallet connect + on-
// chain voting are stubbed here and light up only in an EAS dev build via WALLET_ENABLED
// (see src/config/features.ts, src/wallet/loader.ts, eas.json).
import React, { useEffect, useState } from 'react'
import {
  SafeAreaView, View, Text, Pressable, StatusBar, StyleSheet, Linking, ScrollView,
} from 'react-native'
import { PlayScreen } from './src/screens/PlayScreen'
import { LeaderboardScreen } from './src/screens/LeaderboardScreen'
import { WalletSheet } from './src/components/WalletSheet'
import { loadWallet } from './src/wallet/loader'
import { colors, serif, sans, MAX_WIDTH } from './src/theme'

type TabKey = 'play' | 'leaderboard'
const TABS: { k: TabKey; l: string }[] = [
  { k: 'play', l: 'Play' },
  { k: 'leaderboard', l: 'Leaderboard' },
]

export default function App() {
  const [tab, setTab] = useState<TabKey>('play')
  const [walletOpen, setWalletOpen] = useState(false)

  // In a dev build (WALLET_ENABLED) initialise Reown AppKit lazily. In Expo Go this is a
  // no-op — loadWallet() returns null without ever importing the native modules.
  useEffect(() => {
    loadWallet().then((w) => w?.initWallet()).catch(() => {})
  }, [])

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
            <Text style={st.balAmt}>—<Text style={st.balUnit}> $TTS</Text></Text>
          </View>
          <Pressable style={st.connect} onPress={() => setWalletOpen(true)}>
            <Text style={st.connectTxt}>Connect</Text>
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
            <Pressable key={t.k} style={[st.navItem, tab === t.k && st.navItemActive]} onPress={() => setTab(t.k)}>
              <Text style={[st.navTxt, tab === t.k && st.navTxtActive]}>{t.l}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Screens */}
      <View style={st.main}>
        {tab === 'play' && <PlayScreen onConnect={() => setWalletOpen(true)} />}
        {tab === 'leaderboard' && <LeaderboardScreen />}
      </View>

      <WalletSheet visible={walletOpen} onClose={() => setWalletOpen(false)} />
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
