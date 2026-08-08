// The vote card — a faithful port of the web `.pcard`: a 3:4 photo with a gold rank
// badge + counter overlay, the name, an orange link button, then the vote section with a
// crimson→rose vote bar, an amount field, and the Vote button. In Expo Go the amount
// field + Vote button are a stub that surfaces the connect sheet (no on-chain write).
import React from 'react'
import { View, Text, Image, TextInput, Pressable, StyleSheet, Linking } from 'react-native'
import { colors, serif, sans } from '../theme'
import type { Profile } from '../api/client'

export type VoteProfile = Profile & { votes: number }

export function VoteCard({
  profile,
  rank,
  total,
  maxVotes,
  amount,
  onAmountChange,
  onVote,
  onOpenPhoto,
  width,
}: {
  profile: VoteProfile
  rank: number
  total: number
  maxVotes: number
  amount: string
  onAmountChange: (v: string) => void
  onVote: () => void
  onOpenPhoto: () => void
  width: number
}) {
  const pct = maxVotes > 0 ? Math.round((profile.votes / maxVotes) * 100) : 0
  const link = profile.link_title || 'Profile'
  return (
    <View style={[st.card, { width }]}>
      <Pressable style={st.imgWrap} onPress={onOpenPhoto}>
        {profile.image_url ? (
          <Image source={{ uri: profile.image_url }} style={st.img} resizeMode="cover" />
        ) : (
          <View style={[st.img, st.imgEmpty]}>
            <Text style={st.imgEmptyTxt}>⏳</Text>
          </View>
        )}
        <View style={st.rank}>
          <Text style={st.rankTxt}>#{rank}</Text>
        </View>
        <View style={st.counter}>
          <Text style={st.counterTxt}>{rank} / {total}</Text>
        </View>
      </Pressable>

      <View style={st.info}>
        <Text style={st.name}>{profile.display_name || 'Anonymous'}</Text>
        <Pressable
          style={st.linkBtn}
          onPress={() => {
            const raw = profile.link_url || ''
            const url = /^https?:\/\//.test(raw) ? raw : raw.includes('.') ? 'https://' + raw : 'https://app.temptationtoken.io'
            Linking.openURL(url)
          }}
        >
          <Text style={st.linkTxt}>🔗 {link}</Text>
        </Pressable>
      </View>

      <View style={st.vsec}>
        <View style={st.vtotal}>
          <Text style={st.vtl}>Total Votes</Text>
          <Text style={st.vta}>{profile.votes.toLocaleString()} <Text style={st.vtaUnit}>$TTS</Text></Text>
        </View>
        <View style={st.barWrap}>
          <View style={[st.bar, { width: `${pct}%` }]} />
        </View>
        <View style={st.inputRow}>
          <TextInput
            style={st.input}
            keyboardType="numeric"
            placeholder="Min 5 $TTS"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={onAmountChange}
          />
          <Pressable style={st.voteBtn} onPress={onVote}>
            <Text style={st.voteBtnTxt}>Vote</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  imgWrap: { aspectRatio: 3 / 4, position: 'relative', backgroundColor: colors.surface2 },
  img: { width: '100%', height: '100%' },
  imgEmpty: { alignItems: 'center', justifyContent: 'center' },
  imgEmptyTxt: { fontSize: 46, opacity: 0.3 },
  rank: {
    position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1, borderColor: colors.gold, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3,
  },
  rankTxt: { fontFamily: serif, color: colors.gold, fontSize: 17 },
  counter: {
    position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 3,
  },
  counterTxt: { color: colors.muted, fontSize: 10, letterSpacing: 0.8, fontFamily: sans },
  info: { padding: 14 },
  name: { fontFamily: sans, fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 10 },
  linkBtn: {
    backgroundColor: '#FF7A00', borderRadius: 10, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  linkTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  vsec: { padding: 14, backgroundColor: colors.surface2, borderTopWidth: 1, borderTopColor: colors.border },
  vtotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  vtl: { fontFamily: sans, fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  vta: { fontFamily: sans, fontSize: 18, fontWeight: '800', color: colors.goldLight },
  vtaUnit: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  barWrap: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 3, height: 4, marginBottom: 12, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: colors.rose, borderRadius: 3 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    color: colors.text, fontFamily: sans, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },
  voteBtn: { backgroundColor: colors.crimsonGlow, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 26 },
  voteBtnTxt: { color: '#fff', fontFamily: sans, fontSize: 13, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
})
