// Expo Go-SAFE entry. Shows the live round + a ticking countdown + the current
// profiles, straight from the PRODUCTION API — no native modules, so it runs in Expo Go
// on a physical phone today. WalletConnect / voting is gated behind a dev build (Expo Go
// cannot load the Reown AppKit native modules); see src/wallet/appkit.ts + PHASE1_PLAN.md.
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, Image, ActivityIndicator, RefreshControl, StatusBar, Linking, Pressable, StyleSheet } from 'react-native'
import { api } from './src/api/client'

// Round 6 ends 2026-08-10 04:59:00 UTC (Sunday 11:59 PM EST anchor).
const ROUND_END = 1786337940 * 1000

function useCountdown(end: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.floor((end - now) / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return s <= 0 ? 'settling…' : `${d}d ${p(h)}:${p(m)}:${p(sec)}`
}

export default function App() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cd = useCountdown(ROUND_END)

  const load = async () => {
    setError(null)
    try { const r = await api.listProfiles(); setProfiles(Array.isArray(r.profiles) ? r.profiles : []) }
    catch (e: any) { setError('Could not reach the game server. Pull to retry.') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#F2C14E" />}>
        <Text style={s.brand}>TEMPTATION TOKEN</Text>
        <Text style={s.sub}>Live on Base · Round 6</Text>
        <View style={s.cdBox}>
          <Text style={s.cdLabel}>ROUND ENDS IN</Text>
          <Text style={s.cd}>{cd}</Text>
        </View>

        <Text style={s.section}>Vote board</Text>
        {loading ? <ActivityIndicator color="#F2C14E" style={{ marginTop: 24 }} />
          : error ? <Text style={s.err}>{error}</Text>
          : profiles.length === 0 ? <Text style={s.err}>No profiles yet.</Text>
          : profiles.map((p, i) => (
            <View key={p.profileId || i} style={s.card}>
              {p.image_url ? <Image source={{ uri: p.image_url }} style={s.photo} /> : <View style={[s.photo, s.photoEmpty]} />}
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.display_name || 'Anonymous'}</Text>
                {p.link_title ? <Text style={s.link}>{p.link_title}</Text> : null}
              </View>
            </View>
          ))}

        <Pressable style={s.cta} onPress={() => Linking.openURL('https://app.temptationtoken.io')}>
          <Text style={s.ctaTxt}>Connect wallet & vote →</Text>
          <Text style={s.ctaSub}>Opens the web app (in-app wallet connect ships in the full build)</Text>
        </Pressable>
        <Text style={s.foot}>Expo Go preview · browse + live countdown are live · WalletConnect needs the dev/TestFlight build</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  scroll: { padding: 20, paddingBottom: 48 },
  brand: { color: '#F4F2F7', fontSize: 22, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginTop: 8 },
  sub: { color: '#8A8797', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  cdBox: { backgroundColor: '#15151D', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a36' },
  cdLabel: { color: '#8A8797', fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  cd: { color: '#F2C14E', fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  section: { color: '#F4F2F7', fontSize: 16, fontWeight: '700', marginTop: 26, marginBottom: 12 },
  card: { flexDirection: 'row', gap: 14, backgroundColor: '#15151D', borderRadius: 14, padding: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#22222c' },
  photo: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#222' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { color: '#F4F2F7', fontSize: 15, fontWeight: '600' },
  link: { color: '#8A8797', fontSize: 12, marginTop: 2 },
  err: { color: '#FF2D6E', textAlign: 'center', marginTop: 20 },
  cta: { backgroundColor: '#FF2D6E', borderRadius: 13, padding: 16, marginTop: 22, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 3 },
  foot: { color: '#55545f', fontSize: 11, textAlign: 'center', marginTop: 18 },
})
