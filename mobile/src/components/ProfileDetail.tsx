// Full-screen profile detail — opens when a vote card photo is tapped. Large photo,
// rank, name, live vote total + share of pool, the external link, and a Vote CTA that
// routes through the wallet sheet (stubbed in Expo Go).
import React, { useState } from 'react'
import { Modal, ScrollView, View, Text, Image, Pressable, StyleSheet, Linking } from 'react-native'
import { colors, serif, sans } from '../theme'
import { ReportSheet } from './ReportSheet'
import type { VoteProfile } from './VoteCard'

export function ProfileDetail({
  profile,
  rank,
  totalPool,
  onVote,
  onClose,
}: {
  profile: VoteProfile | null
  rank: number
  totalPool: number
  onVote: () => void
  onClose: () => void
}) {
  // Report lives on the profile detail because that is the one screen reachable from
  // EVERY profile — the card, the carousel and the leaderboard all open it.
  const [reporting, setReporting] = useState(false)

  const share = totalPool > 0 && profile ? Math.round((profile.votes / totalPool) * 100) : 0
  return (
    <Modal visible={!!profile} animationType="slide" onRequestClose={onClose}>
      <View style={st.root}>
        <ScrollView contentContainerStyle={st.scroll}>
          <Pressable style={st.close} onPress={onClose} hitSlop={12}>
            <Text style={st.closeTxt}>✕</Text>
          </Pressable>
          {profile?.image_url ? (
            <Image source={{ uri: profile.image_url }} style={st.img} resizeMode="cover" />
          ) : (
            <View style={[st.img, st.imgEmpty]}><Text style={st.imgEmptyTxt}>⏳</Text></View>
          )}

          <View style={st.body}>
            <View style={st.rankRow}>
              <Text style={st.rank}>Rank #{rank}</Text>
              {share > 0 ? <Text style={st.share}>{share}% of pool</Text> : null}
            </View>
            <Text style={st.name}>{profile?.display_name || 'Anonymous'}</Text>

            <View style={st.statBox}>
              <Text style={st.statLabel}>Total Votes</Text>
              <Text style={st.statValue}>{(profile?.votes ?? 0).toLocaleString()} <Text style={st.statUnit}>$TTS</Text></Text>
            </View>

            {profile?.link_url ? (
              <Pressable
                style={st.link}
                onPress={() => {
                  const raw = profile.link_url || ''
                  const url = /^https?:\/\//.test(raw) ? raw : 'https://' + raw
                  Linking.openURL(url)
                }}
              >
                <Text style={st.linkTxt}>🔗 {profile.link_title || 'View Profile'}</Text>
              </Pressable>
            ) : null}

            <Pressable style={st.vote} onPress={onVote}>
              <Text style={st.voteTxt}>Vote $TTS on {profile?.display_name || 'this profile'}</Text>
            </Pressable>
            <Text style={st.foot}>Winning profile earns 35% of the round pool · min 5 $TTS · votes are final</Text>

            {/* Guideline 1.2: a way to report offensive content, on every profile. */}
            <Pressable style={st.report} onPress={() => setReporting(true)} hitSlop={8}>
              <Text style={st.reportTxt}>⚑ Report this entry</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <ReportSheet
        visible={reporting}
        profileId={profile?.profileId ?? null}
        profileName={profile?.display_name}
        onClose={() => setReporting(false)}
      />
    </Modal>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  scroll: { paddingBottom: 48 },
  close: {
    position: 'absolute', top: 44, right: 18, zIndex: 10, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: colors.text, fontSize: 16 },
  report: { marginTop: 18, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  reportTxt: { fontFamily: sans, fontSize: 12.5, color: colors.muted, textDecorationLine: 'underline' },
  img: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface2 },
  imgEmpty: { alignItems: 'center', justifyContent: 'center' },
  imgEmptyTxt: { fontSize: 64, opacity: 0.3 },
  body: { padding: 20 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rank: { fontFamily: serif, fontStyle: 'italic', fontSize: 18, color: colors.gold },
  share: { fontFamily: sans, fontSize: 12, color: colors.muted, letterSpacing: 0.6 },
  name: { fontFamily: sans, fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 18 },
  statBox: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 16, marginBottom: 16,
  },
  statLabel: { fontFamily: sans, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginBottom: 4 },
  statValue: { fontFamily: sans, fontSize: 24, fontWeight: '800', color: colors.goldLight },
  statUnit: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  link: { backgroundColor: '#FF7A00', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  linkTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase' },
  vote: { backgroundColor: colors.crimsonGlow, borderRadius: 10, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: colors.rose },
  voteTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  foot: { fontFamily: sans, fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 14, lineHeight: 18 },
})
